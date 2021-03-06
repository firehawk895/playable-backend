var express = require('express')
var router = express.Router()

var config = require('../config')
var gcm = require('node-gcm');
var sender = new gcm.Sender(config.gcm.apiKey);
var message = new gcm.Message();
var customUtils = require('../utils.js');
var UserModel = require('../models/User');

var request = require('request');

//kardo sab import, node only uses it once
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var kew = require('kew');
var constants = require('../constants');
var qbchat = require('../Chat/qbchat');
var MatchModel = require('../models/Match');
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var CronJob = require('cron').CronJob;

var Firebase = require("firebase");
var notificationsRef = new Firebase(config.firebase.url, config.firebase.secret);

var Firebase = require("firebase");
var requestsRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests)

var NF = require('../notifications/notificationFactory');
// var date = new Date()

console.log("dispatchers loaded (sounds very cool)")

/**
 * Legend:
 * 'link' key to be used for information that allows to redirect inside the mobile app
 */

/**
 * @param userId
 * @param usersName
 */
function welcome(userId, usersName, phoneNumber, username) {
    console.log("welcome notification -- ")
    console.log("userId : " + userId)
    console.log("usersName : " + usersName)

    var titleString = "Hello " + usersName + "!";

    var nofObj = {
        "created": (new Date()).getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": constants.notifications.links.discover,
        "title": titleString,
        "text": "Welcome to Playable! We look forward to providing you a great playing experience :)",
        "photo": ""
    };
    NF.send(nofObj, constants.notifications.type.inApp, null, [userId]);
    sendSlackMessage("*NEW PLAYER* in the house nigga!!!! - Naam: " + usersName + ", username: " + username + ", phone: " + phoneNumber)
}

/**
 * @type {*|CronJob}
 */
var discoverDailyNof = new CronJob('00 00 10 * * 0-7', function () {
    var MatchModel = require('../models/Match')
    console.log("Cron being fired : discover matches notification")
    MatchModel.getDiscoverableMatchesCount()
        .then(function (count) {
            console.log("new matches : " + count)
            var nofObj = {
                "created": (new Date()).getTime(),
                "is_clicked": false,
                "is_read": false,
                "link": constants.notifications.links.discover,
                "title": "Discover matches around you",
                "text": "There are " + count + " matches hosted around you! Click to play!",
                "photo": ""
            };
            everyoneNotificationDispatcer(0, nofObj, constants.notifications.type.push)
        })
}, null, true, 'Asia/Kolkata')

/**
 * fire a reminder notification for an upcoming match.
 * suppose to be 1 hour before match
 * @type {*|CronJob}
 */
var matchReminderCron = new CronJob('0 0/15 * * * *', function () {
    console.log("recommendationCron done")
    var dbUtils = require('../dbUtils');
    var customUtils = require('../utils');
    var MatchModel = require('../models/Match')

    dbUtils.getAllItemsWithFields("matches", MatchModel.matchWithinHourQuery(), ["value.playing_time", "value.title", "value.sport"])
        .then(function (results) {
            console.log("these are matches within the next hour :")
            results.forEach(function (result) {
                console.log(result.id)
                var nofObj = {
                    "created": (new Date()).getTime(),
                    "id": result.id,
                    "is_clicked": false,
                    "is_read": false,
                    "link": constants.notifications.links.matchId,
                    "title": "You have an upcoming match!",
                    "text": "Your match titled " + result.title + " of " + result.sport + " is about to begin at " + customUtils.getFormattedDate(result.playing_time),
                    "photo": ""
                };
                matchNotificationDispatcher(result.id, nofObj, constants.notifications.type.both)
                db.newPatchBuilder("matches", result.id)
                    .add("notified", true)
                    .apply()
                    .then(function (result) {
                        console.log("match notified value switched to true")
                    })
                    .fail(function (err) {
                        console.log(err)
                        console.log("UNABLE to set match notified value switched to true")
                    })
            })
        })
}, null, true, 'Asia/Kolkata')

/**
 * @param eventId
 * @param eventName
 */
function newEvent(eventId, eventName) {
    console.log("disaptching everyone! new Event!")
    var nofObj = {
        "id": eventId,
        "created": (new Date()).getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": constants.notifications.links.eventId,
        "title": "New event : " + eventName,
        "text": "New event " + eventName + " hosted! Check it out now!",
        "photo": ""
    };
    everyoneNotificationDispatcer(0, nofObj, constants.notifications.type.both)
}

function newMatch(matchId, matchName, hostName, hostNumber, hostUsername, sport, isFacility, playing_time) {
    var message
    if (isFacility) {
        message = "*FACILITY MATCH HOSTED* : id: " + matchId + " matchName: " + matchName + " hostName: " + hostName + " hostNumber: " + hostNumber + " hostUsername: " + hostUsername + " sport: " + sport
            + "at " + customUtils.getFormattedDate(playing_time)
    } else {
        message = "*non facility match hosted* : id: " + matchId + " matchName: " + matchName + " hostName: " + hostName + " hostNumber: " + hostNumber + " hostUsername: " + hostUsername + " sport: " + sport
            + "at " + customUtils.getFormattedDate(playing_time)
    }
    sendSlackMessage(message)
}

/**
 * @param eventId
 * @param eventName
 * @param userId
 * @param google_form
 */
function joinedEvent(eventId, eventName, userId, google_form) {
    var UserModel = require('../models/User');
    console.log("joinedEvent dispatcher hit")
    var nofObj = {
        "eventId": eventId,
        "created": (new Date()).getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": constants.notifications.links.eventId,
        "id": eventId,
        "title": "You successfully joined the event " + eventName,
        "text": "New event " + eventName + " hosted! Check it out now!",
        "photo": ""
    };
    console.log("elucidating nof object : ")
    console.log(nofObj)
    UserModel.getGcmIdsForUserIds([userId])
        .then(function (gcmIds) {
            console.log("getGcmIdsForUserIds worked")
            NF.send(nofObj, constants.notifications.type.both, gcmIds, [userId]);
        })
        .fail(function (err) {
            console.log(err)
            console.log("getGcmIdsForUserIds failed")
        })

    message = "You have been registered for the event - " + eventName + "."
    if (google_form)
        message = message + " Please click the following link for more information - " + google_form

    UserModel.getUserPromise(userId)
        .then(function (result) {
            var theUser = result.body
            console.log(theUser)
            sendSlackMessage("user has joined event - " + eventName + " , userName: " + theUser.name + " userNumber: " + theUser.phoneNumber + " userUsername: " + theUser.username)
            return customUtils.sendSms(message, theUser.phoneNumber)
        })
        .then(function (result) {
            console.log("sms dispatched")
        })
        .fail(function (err) {
            console.log("joinedEvent nof dispatch failed")
            console.log(err)
        })
}

// function invitedToMatch(invitedUserIdList, matchId, matchSport, hostUserId, hostName) {
//     UserModel.getGcmIdsForUserIds(invitedUserIdList)
//         .then(function (invitedUserGCMidList) {
//             var nofObj = {
//                 "matchId": matchId,
//                 "userId": hostUserId,
//                 "created": date.getTime(),
//                 "is_clicked": false,
//                 "is_read": false,
//                 "link": 'matches',
//                 "title": "You have been invited to play!",
//                 "text": "You have been invited to play a match of " + matchSport + " by " + hostName,
//                 "photo": ""
//             };
//             NF.send(nofObj, constants.notifications.type.both, invitedUserGCMidList, invitedUserIdList);
//         })
// }

/**
 * I have decided that each request method should have the responsibility to create their own notification
 * otherwise there will be tight coupling between the conditions written here and with requests.
 * doing it in the requests section ensures encapsulation
 * @param username
 * @param message
 */
// requestsRef.on("child_added", function (childSnapshot, prevChildKey) {
//     var userId = childSnapshot.key()
//     var userRequestRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests + "/" + userId, config.firebase.secret)
//     /**
//      * Register a child_changed listener for one user's request
//      * */
//     userRequestRef.child("data").on("child_added", function (childSnapshot, prevChildKey) {
//         console.log("child_changed of request")
//         var requestObj = childSnapshot.val()
//         console.log(requestObj)
//
//         //if (requestObj.status == constants.requests.status.accepted) {
//         if(customUtils.isRecent(requestObj.timestamp)) {
//            
//         }
//         console.log("status changed... parsing it up")
//         RequestModel.parseRequestObject(requestObj)
//         //}
//
//     })
// })

/**
 * generate notifications for create requests
 * TODO: untested
 * @param message
 * @param timestamp
 * @param userId
 */
function pushRequestNotification(message, timestamp, userId) {
    var UserModel = require('../models/User');
    var nofObj = {
        "created": timestamp,
        "is_clicked": false,
        "is_read": false,
        "link": constants.notifications.links.request,
        "title": "You have a request!",
        "text": message,
        "photo": ""
    };
    UserModel.getGcmIdsForUserIds([userId])
        .then(function (gcmIds) {
            console.log("getGcmIdsForUserIds worked")
            NF.send(nofObj, constants.notifications.type.push, gcmIds, null);
        })
        .fail(function (err) {
            console.log(err)
            console.log("pushRequestNotification getGcmIdsForUserIds failed")
        })
}

/**
 * generate notification for accepting a connection request
 * TODO : untested
 * @param senderId
 * @param accepterId
 */
function acceptConnectionRequest(accepterId, senderId) {
    console.log("acceptConnectionRequest")
    console.log("senderId " + senderId + " accepterId " + accepterId)
    var UserModel = require('../models/User');
    var theUser
    UserModel.getUserPromise(accepterId)
        .then(function (result) {
            theUser = result.body
            return UserModel.getGcmIdsForUserIds([senderId])
        })
        .then(function (gcmIds) {
            var nofObj = {
                "id": accepterId,
                "created": (new Date()).getTime(),
                "is_clicked": false,
                "is_read": false,
                "link": constants.notifications.links.userId,
                "title": "Request Accepted",
                "text": theUser.name + " has accepted your request to connect. Chat and play now!",
                "photo": ""
            };
            NF.send(nofObj, constants.notifications.type.push, gcmIds, null);
        })
        .fail(function (err) {
            console.log("error: acceptConnectionRequest push notification" + senderId + " -> " + accepterId)
            console.log(err)
        })
}

/**
 * generate notification for a one on one match being hosted
 * @param user1id
 * @param user2id
 * @param matchPayload
 */
function acceptMatchRequest(user1id, user2id, matchPayload) {
    console.log("notification dispatcher : acceptMatchRequest")
    console.log(user1id)
    console.log(user2id)
    console.log(matchPayload)
    var UserModel = require('../models/User');
    var kew = require('kew');
    kew.all([
        UserModel.getUserPromise(user1id),
        UserModel.getUserPromise(user2id)
    ])
        .then(function (results) {
            var user1 = results[0].body
            var user2 = results[1].body
            var nofObj = {
                "id": matchPayload["id"],
                "created": (new Date()).getTime(),
                "is_clicked": false,
                "is_read": false,
                "link": constants.notifications.links.matchId,
                "title": "1on1 Match Accepted",
                "text": "Game on! Your match of " + matchPayload.sport + "with " + user2.name + " has been hosted! Chat with your partner!",
                "photo": ""
            };
            console.log("dispatching : ")
            console.log(nofObj)
            NF.send(nofObj, constants.notifications.type.push, [user2.gcmId], null);
        })

    // kew.all([
    //     UserModel.getUserPromise(user1id),
    // ])
    //     .then(function (userdata) {
    //         nofObj = {
    //             "created": date.getTime(),
    //             "is_clicked": false,
    //             "is_read": false,
    //             "link": constants.notifications.links.request,
    //             "title": "1on1 Match Accepted",
    //             "text": "Game on! Your match of " + matchPayload.sport + "with " + userdata[0].body.name + " has been hosted! Chat with your partner!",
    //             "photo": ""
    //         };
    //         nofObj2 = {
    //             "created": date.getTime(),
    //             "is_clicked": false,
    //             "is_read": false,
    //             "link": constants.notifications.links.request,
    //             "title": "1on1 Match Accepted",
    //             "text": "Game on! Your match of " + matchPayload.sport + "with " + userdata[1].body.name + " has been hosted! Chat with your partner!",
    //             "photo": ""
    //         };
    //         return kew.all([
    //             UserModel.getGcmIdsForUserIds([user1id]),
    //             UserModel.getGcmIdsForUserIds([user1id])
    //         ])
    //     })
    //     .then(function (gcmIds) {
    //         NF.send(nofObj1, constants.notifications.type.push, gcmIds[0], null);
    //         NF.send(nofObj2, constants.notifications.type.push, gcmIds[1], null);
    //     })
    //     .fail(function (err) {
    //         console.log("acceptMatchRequest push notification failed")
    //         console.log(err)
    //     })
}

/**
 * TODO : not tested
 * @param fromUserId
 * @param toUserId
 * @param matchPayload
 */
function acceptJoinMatchRequest(fromUserId, toUserId, matchPayload) {
    var UserModel = require('../models/User');
    var nofObj
    UserModel.getUserPromise(function (result) {
        var theUser = result.body
        nofObj = {
            "id": matchPayload["id"],
            "created": (new Date()).getTime(),
            "is_clicked": false,
            "is_read": false,
            "link": constants.notifications.links.matchId,
            "title": "Your invite was accepted!",
            "text": "Game on! Your match of " + matchPayload.sport + "with " + theUser.name + " has been hosted! Chat with your partner!",
            "photo": ""
        };
        return UserModel.getGcmIdsForUserIds([toUserId])
    })
        .then(function (gcmIds) {
            NF.send(nofObj, constants.notifications.type.push, gcmIds, null)
        })
        .fail(function (err) {

        })
}

function userAcceptsHostInvite(matchId, joineeId) {
    /**
     * super cool shitty hack
     * fire notifications to both joinee and host.
     * jiska screen open hai, usko notificatin nahi mileyga
     * (logic resides in android)
     */
    console.log("userAcceptsHostInvite inside")
    var UserModel = require('../models/User');
    var MatchModel = require('../models/Match')
    var promises = [
        UserModel.getUserPromise(joineeId),
        MatchModel.getMatchPromise(matchId)
    ]
    var theUser
    var theMatch

    var theUser2
    var theMatch2
    
    var nofObj
    kew.all(promises)
        .then(function (results) {
            theUser = results[0].body
            theMatch = results[1].body

            nofObj = {
                "id" : matchId,
                "created": (new Date()).getTime(),
                "is_clicked": false,
                "is_read": false,
                "link": constants.notifications.links.matchId,
                "title": "Invitation accepted!",
                "text": theUser.name + " has accepted your invitation and successfully joined your match of "
                + theMatch.sport + " titled " + theMatch.title,
                "photo": ""
            };
            return UserModel.getGcmIdsForUserIds([theMatch.host.id])
        })
        .then(function (gcmIds) {
            NF.send(nofObj, constants.notifications.type.both, gcmIds, [theMatch.host.id])
        })
        .fail(function (err) {
            console.log("Error dispatching userAcceptsHostInvite - host.id")
            console.log(err)
        })
    //
    // kew.all(promises)
    //     .then(function (results) {
    //         theUser2 = results[0].body
    //         theMatch2 = results[1].body
    //
    //         nofObj = {
    //             "id" : matchId,
    //             "created": (new Date()).getTime(),
    //             "is_clicked": false,
    //             "is_read": false,
    //             "link": constants.notifications.links.matchId,
    //             "title": "Match request accepted!",
    //             "text": "The host " + theMatch2["host"]["name"] + " has accepted you into the match of "
    //             + theMatch2.sport + " titled " + theMatch2.title,
    //             "photo": ""
    //         };
    //         return UserModel.getGcmIdsForUserIds([joineeId])
    //     })
    //     .then(function (gcmIds) {
    //         NF.send(nofObj, constants.notifications.type.both, gcmIds, [joineeId])
    //     })
    //     .fail(function (err) {
    //         console.log("Error dispatching userAcceptsHostInvite - joineeId")
    //         console.log(err)
    //     })
}

function feedback(username, message) {
    var nofObj = {
        "created": (new Date()).getTime(),
        "id": (new Date()).getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": "feedback",
        "title": "Response for your Feedback",
        "text": "You received a message from Playable Team : " + message.split(":")[1].trim(),
        "photo": ""
    };

    db.newSearchBuilder()
        .collection('users')
        .query('value.username:`' + username + '`')
        .then(function (result) {
            console.log("result.body.total_count > 0 -- " + result.body.total_count)
            if (result.body.total_count > 0) {
                var user = result.body.results[0].value;
                console.log("feedback user")
                console.log(user)
                NF.send(nofObj, constants.notifications.type.push, [user.gcmId], [user.id]);
            } else {
                request.post(config.newSlack.feedbackHook, {
                    body: JSON.stringify({text: "User nahi mila bhai, chasma pehen lo"})
                })
            }
        })
        .fail(function (err) {
            console.log(err.body.message);
        });
}

/**
 * this approach is more scalable when users increase in the system
 * because it does not attempt to load all users in memory
 * ya we are talking about post series A funding.
 * recursive dispatch notifications to everyone
 * @param offset
 * @param nofObj
 * @param type
 */
var everyoneNotificationDispatcer = function (offset, nofObj, type) {
    console.log("everyone time")
    var params = {
        limit: config.pagination.limit,
        offset: offset
    }
    db.search('users', "*", params)
        .then(function (result) {
            console.log("user recursion")
            var recieverIds = result.body.results.map(function (user) {
                return user.value.id
            });

            var recieverGcmIds = result.body.results.map(function (user) {
                return user.value.gcmId
            });

            console.log("sending")
            console.log(recieverIds)
            console.log(recieverGcmIds)
            NF.send(nofObj, type, recieverGcmIds, recieverIds)
            if (result.body.next) {
                everyoneNotificationDispatcer(offset + config.pagination.limit, nofObj, type)
            }
        })
        .fail(function (err) {
            console.log(err);
        });
}

var matchNotificationDispatcher = function (matchId, nofObj, type) {
    var MatchModel = require('../models/Match')
    var dbUtils = require('../dbUtils')
    MatchModel.getMatchParticipantsPromise(matchId)
        .then(function (results) {
            var theUsers = dbUtils.injectId(results)
            var gcmIds = theUsers.map(function (aUser) {
                return aUser.gcmId
            })
            var inAppIds = theUsers.map(function (aUser) {
                return aUser.id
            })
            NF.send(nofObj, type, gcmIds, inAppIds)
        })
        .fail(function (err) {
            console.log("matchNotificationDispatcher failed")
            console.log(err)
        })
}

var sendSlackMessage = function (message) {
    var request = require('request');
    request.post(config.newSlack.feedbackHook, {
        body: JSON.stringify({text: message})
    })
}

module.exports = {
    welcome: welcome,
    newEvent: newEvent,
    joinedEvent: joinedEvent,
    feedback: feedback,
    pushRequestNotification: pushRequestNotification,
    acceptConnectionRequest: acceptConnectionRequest,
    acceptMatchRequest: acceptMatchRequest,
    acceptJoinMatchRequest: acceptJoinMatchRequest,
    sendSlackMessage: sendSlackMessage,
    newMatch: newMatch,
    userAcceptsHostInvite: userAcceptsHostInvite
}