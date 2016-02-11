var express = require('express')
var router = express.Router()

var gcm = require('node-gcm');
var sender = new gcm.Sender(config.gcm.apiKey);
var message = new gcm.Message();
var config = require('./../config')
customUtils = require('./../utils.js');

var Firebase = require("firebase");
var notificationsRef = new Firebase(config.firebase.url, config.firebase.secret);

var NF = new NotificationFactory();
var date = new Date()

/**
 * Legend:
 * 'link' key to be used for information that allows to redirect inside the mobile app
 */

function welcome(userId, usersName) {
    var titleString = "Hello " + usersName + "!";

    var nofObj = {
        "created": date.getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": 'discover',
        "title": titleString,
        "text": "Welcome to Playable! We look forward to providing you a great playing experience :)",
        "photo": ""
    };
    NF.sendNotification(nofObj, [userId], null, "app");
}

function newEvent(eventId, eventName) {
    var nofObj = {
        "eventId": eventId,
        "created": date.getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": 'events',
        "title": "New event : " + eventName,
        "text": "New event " + eventName + " hosted! Check it out now!",
        "photo": ""
    };
    everyoneNotificationDispatcer(0, nofObj, "both")
}

function invitedToMatch(invitedUserIdList, matchId, matchSport, hostUserId, hostName) {
    customUtils.getGcmIdsForUserIds(invitedUserIdList)
        .then(function (invitedUserGCMidList) {
            var nofObj = {
                "matchId": matchId,
                "userId": hostUserId,
                "created": date.getTime(),
                "is_clicked": false,
                "is_read": false,
                "link": 'matches',
                "title": "You have been invited to play!",
                "text": "You have been invited to play a match of " + matchSport + " by " + hostName,
                "photo": ""
            };
            NF.sendNotification(nofObj, invitedUserIdList, invitedUserGCMidList, "both");
        })
}

/**
 * recursive dispatch notifications to everyone
 * @param offset
 * @param nofObj
 * @param type
 */
var everyoneNotificationDispatcer = function (offset, nofObj, type) {
    var params = {
        limit: config.pagination.limit,
        offset: offset
    }
    db.search('users', "*", params)
        .then(function (result) {
            var recieverIds = result.body.results.map(function (user) {
                return user.value.id
            });

            var recieverGcmIds = result.body.results.map(function (user) {
                return user.value.gcmId
            });

            NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);

            if (result.body.next) {
                everyoneNotificationDispatcer(offset + config.pagination.limit, nofObj, type)
            }
        })
        .fail(function (err) {
            console.log(err.body.message);
        });
}


function NotificationFactory() {
    this.sendNotification = function (nofObj, recieverIds, recieverGcmIds, type) {
        //console.log("----------------nofObj : ----------------------")
        //console.log("----------------" + type)
        //console.log(nofObj)
        //console.log("receivers : ")
        //console.log(recieverIds)
        //console.log("receivers GCMs: ")
        //console.log(recieverGcmIds)
        switch (type) {
            case "both":
            {
                message.addData(nofObj);
                sender.send(message, recieverGcmIds, function (err, result) {
                    if (err) console.error(err);
                });
                recieverIds.forEach(function (recieverId) {
                    notificationsRef.child(recieverId + "/nof/").push().set(nofObj);
                    notificationsRef.child(recieverId + "/count").transaction(function (current_value) {
                        return (current_value || 0) + 1;
                    });
                })
                console.log("Both")
            }
                break;
            case "app":
            {
                recieverIds.forEach(function (recieverId) {
                    notificationsRef.child(recieverId + "/nof/").push().set(nofObj);
                    notificationsRef.child(recieverId + "/count").transaction(function (current_value) {
                        return (current_value || 0) + 1;
                    });
                })
                console.log("App")
            }
                break;
            case "push":
            {
                message.addData(nofObj);
                sender.send(message, recieverGcmIds, function (err, result) {
                    if (err) console.error(err);
                });
                console.log("Push")
            }
                break;
            default:
                console.log("Seriously, frontend?")
        }
    }
}


module.exports = {
    welcome: welcome,
    newEvent: newEvent,
    invitedToMatch: invitedToMatch
}