/**
 * Developer rant incoming:
 * Implement event dispatchers as per the pub/sub or observer pattern
 * I have determined that this is not required now,
 * therefore the project now directly dispatches notifications
 *
 * dekh bhai notification systems are best built using the observer pattern
 * https://www.quora.com/How-important-are-design-patterns-in-software-development/answer/Ankan-Adhikari?srid=p3D8&share=ec5a917a
 *
 * but that increases the amount of code at the cost of decoupling.
 * the decoupling will make sense later, maybe
 *
 * I'm thinking of a an evented system that fires events to a database like firebase
 * that can be listened by any client.
 *
 * Anyway, back to work.
 */

//var express = require('express');
//var router = express.Router();
//
//var passport = require('passport');
//customUtils = require('../utils.js');
//var constants = require('../constants.js');
//
//var config = require('../config.js');
////var config = require('../models/Match.js');
//var matchValidation = require('../validations/Match.js');
//var oio = require('orchestrate');
//oio.ApiEndPoint = config.db.region;
//var db = oio(config.db.key);
//
//var qbchat = require('../Chat/qbchat.js');
//var dispatchers = require('./dispatchers')
//var kew = require('kew')
//var Firebase = require("firebase");
//var firebaseRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.newMatches)
//var date = new Date()
//
//firebaseRef.child(constants.events.matches.created).on("child_added", function (snapshot) {
//    var newMatch = snapshot.val()
//    if (customUtils.isRecent(newMatch[constants.events.timestampkey])) {
//        var invitedUserIdList = newMatch.invitedUserIds.split(",")
//        dispatchers.invitedToMatch(invitedUserIdList, newMatch.id, newMatch.sport, newMatch.host.id, newMatch.host.name)
//    }
//})
//
//firebaseRef.child(constants.events.events.created).on("child_added", function (snapshot) {
//    var newEvent = snapshot.val()
//    if (customUtils.isRecent(newMatch[constants.events.timestampkey])) {
//        dispatchers.newEvent(newEvent.id, newEvent.title)
//    }
//})

module.exports = router;