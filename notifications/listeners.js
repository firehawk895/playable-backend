/**
 * Listeners for decoupled events/notifications to be fired
 */
var express = require('express');
var router = express.Router();
//
//var constants = require('constants.js');
//
//var passport = require('passport');
//customUtils = require('utils.js');
//
//var config = require('config.js');
//var oio = require('orchestrate');
//oio.ApiEndPoint = config.db.region;
//var db = oio(config.db.key);
//
//var qbchat = require('qbchat.js');
//var kew = require('kew')

//kardo sab import, node only uses it once
var config = require('../config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require('../utils.js');
var constants = require('../constants');
var qbchat = require('../Chat/qbchat');
var UserModel = require('../models/User');
var MatchModel = require('../models/Match');
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');
var notificationFactory = require('../notifications/notificationFactory')

var Firebase = require("firebase");
var requestsRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests)

/**
 * Push notifications for every new request added. decoupled listeners (kick ass huh?)
 */
requestsRef.on("child_added", function (snapshot) {
    var userId = snapshot.key()
    var userRequestRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests + "/" + userId, config.firebase.secret)
    /**
     * Register a child_added listener for one user's request
     * */
    userRequestRef.child("data").on("child_added", function (childSnapshot, prevChildKey) {
        var requestObj = childSnapshot.val()

        if (customUtils.isRecent(requestObj.timestamp)) {
            UserModel.getGcmIdsForUserIds(requestObj.toUserId)
                .then(function (gcmIds) {
                    notificationFactory.send(requestObj, constants.notifications.type.push, gcmIds, null)
                })
                .fail(function (err) {
                    console.log("Error dispatching push notification for request")
                    console.log(err)
                    console.log(requestObj)
                })
        }
    })
})

module.exports = router;