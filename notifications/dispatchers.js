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

var NF = require('../notifications/notificationFactory');
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
    NF.send(nofObj, constants.notification.type.inApp, null, [userId]);
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
    everyoneNotificationDispatcer(0, nofObj, constants.notifications.type.both)
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
            NF.send(nofObj, constants.notification.type.both, gcmIds, [userId]);
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
            NF.send(nofObj, constants.notification.type.both, invitedUserGCMidList, invitedUserIdList);
        })
}

function feedback(username, message) {
    var nofObj = {
        "created": date.getTime(),
        "id": date.getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": "Feedback Channel",
        "title": "Response for your Feedback",
        "text": "You got a response from Playable Team : " + message,
        "photo": "https://s3-ap-southeast-1.amazonaws.com/pyoopil-tssc-files/pyoopil-logo.png"
    };

    db.newSearchBuilder()
        .collection('users')
        .query('value.username:`' + username + '`')
        .then(function (result) {
            console.log("result.body.total_count > 0 -- " + result.body.total_count)
            if (result.body.total_count > 0) {
                user = result.body.results[0].value;
                NF.send(nofObj, constants.notification.type.both, [user.gcmId], [user.id]);
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
            console.log(err.body.message);
        });
}

module.exports = {
    welcome: welcome,
    newEvent: newEvent,
    invitedToMatch: invitedToMatch,
    joinedEvent: joinedEvent,
    feedback: feedback
}