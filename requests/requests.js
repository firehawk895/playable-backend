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

var Firebase = require("firebase");
var recommendationsRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests)

/**
 *
 * //TODO: Scaling notes:
 * The number of entries will keep increasing, on("child_added") will be called
 * for each entry, parsing each of them. slash the retrieved records or move them to
 * another tree in firebase
 *
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
 *  a sanity check is required, an additional boolean flag "backendParsed"
 *  will tell you if it needs to be parsed or not
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

        //if (requestObj.status == constants.requests.status.accepted) {
            console.log("status switched to accepted")
            RequestModel.parseRequestObject(requestObj)
        //}

    })
})

//TODO : set backendParsed true here itself. or backendAttemptedToParse
module.exports = router;



