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
var config = require(__base + './config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require(__base + './utils.js');
var constants = require(__base + './constants');
var qbchat = require(__base + './Chat/qbchat');
var UserModel = require(__base + './models/User');
var MatchModel = require(__base + './models/Match');
var EventModel = require(__base + './models/Event');
var RequestModel = require(__base + './requests/Request');
var dbUtils = require(__base + './dbUtils');
var EventSystem = require(__base + './events/events');

var Firebase = require("firebase");
var recommendationsRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests)

/**
 * Listener:
 * listen to requests updated by every user
 *
 * Request object format:
 * refer ro customUtils.createMatchRequestInvite
 * [Keep documentation updated for a good life.]
 *  var payload = {
 *      fromUserId: user1id,
 *      toUserId: user2id,
 *      type: constants.requests.type.match,
 *      status: constants.requests.status.pending,
 *      match: matchPayload
 *  }
 */
recommendationsRef.on("child_added", function (snapshot) {
    var userId = snapshot.key()
    console.log("hello")
    var userRequestRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests + "/" + userId, config.firebase.secret)
    /**
     * Register a child_changed listener for one user's request
     * */
    userRequestRef.child("data").on("child_changed", function (childSnapshot, prevChildKey) {
        console.log("child_changed of request")
        var requestObj = childSnapshot.val()
        console.log(requestObj)

        if (requestObj.status == constants.requests.status.accepted) {
            console.log("status switched to accepted")
            customUtils.parseRequestObject(requestObj)
        }

    })
})

module.exports = router;



