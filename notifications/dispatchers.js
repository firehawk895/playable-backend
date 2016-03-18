var express = require('express')
var router = express.Router()

var config = require('../config')
var gcm = require('node-gcm');
var sender = new gcm.Sender(config.gcm.apiKey);
var message = new gcm.Message();
var customUtils = require('../utils.js');
var UserModel = require('../models/User');

//kardo sab import, node only uses it once
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var constants = require('../constants');
var qbchat = require('../Chat/qbchat');
var MatchModel = require('../models/Match');
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');

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
    console.log("disaptching everyone! new Event!")
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

function joinedEvent(eventId, eventName, userId) {
    var nofObj = {
        "eventId": eventId,
        "created": date.getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": 'events',
        "title": "You successfully joined the event " + eventName,
        "text": "New event " + eventName + " hosted! Check it out now!",
        "photo": ""
    };
    UserModel.getGcmIdsForUserIds([userId])
        .then(function (gcmIds) {
            NF.sendNotification(nofObj, [userId], gcmIds, "both");
        })
}

function invitedToMatch(invitedUserIdList, matchId, matchSport, hostUserId, hostName) {
    UserModel.getGcmIdsForUserIds(invitedUserIdList)
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
    this.sendNotification = function (nofObj, receiverIds, recieverGcmIds, type) {
        //console.log("----------------nofObj : ----------------------")
        //console.log("----------------" + type)
        //console.log(nofObj)
        //console.log("receivers : ")
        //console.log(receiverIds)
        //console.log("receivers GCMs: ")
        //console.log(recieverGcmIds)
        /**
         * obviously you can compress this
         */
        switch (type) {
            case "both":
            {
                message.addData(nofObj);
                sender.send(message, recieverGcmIds, function (err, result) {
                    if (err) console.error(err);
                });
                receiverIds.forEach(function (recieverId) {
                    pushToFireBase(recieverId, nofObj)
                })
                console.log("Both")
            }
                break;
            case "app":
            {
                receiverIds.forEach(function (receiverId) {
                    pushToFireBase(receiverId, nofObj)
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

function pushToFireBase(receiverId, nofObj) {
    notificationsRef.child("/nof/" + receiverId + "/data").push().set(nofObj);
    notificationsRef.child("/nof/" + receiverId + "/count").transaction(function (current_value) {
        return (current_value || 0) + 1;
    });
}


module.exports = {
    welcome: welcome,
    newEvent: newEvent,
    invitedToMatch: invitedToMatch,
    joinedEvent: joinedEvent
}