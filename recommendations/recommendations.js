var express = require('express');
var router = express.Router();

var passport = require('passport');
customUtils = require('./../utils.js');
var constants = require('./../constants.js');

var config = require('./../config.js');
//var config = require('../models/Match.js');
var matchValidation = require('./../validations/Match.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var kew = require('kew')
var Firebase = require("firebase");
var newMatchesRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.newMatches)
var recommendationsRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.recommendations)

/**
 * listener:
 * new matches created
 */
newMatchesRef.on("child_added", function (snapshot) {
    /**
     * dispatch recommendations rating requests for each user
     */
    var newMatchObj = snapshot.val()
    console.log("wow. new match, recommendation listener has heard it!")
    console.log(newMatchObj)
    // customUtils.createRecommendationCron(newMatchObj.matchId, newMatchObj.playing_time)
})

/**
 * Listener:
 * listen to recommendations marked by every user
 */
// recommendationsRef.on("child_added", function (snapshot) {
//     var userId = snapshot.key()
//     var userRecoRef = new Firebase(config.firebase.url + "/" + constants.firebase.recommendations + "/" + userId, config.firebase.secret)
//     /**
//      * Register a child_changed listener for one user's recommendation
//      * */
//     userRecoRef.on("child_changed", function (childSnapshot, prevChildKey) {
//         var recoObj = childSnapshot.val()
//         if (customUtils.isRecent(recoObj.timestamp)) customUtils.parseRecObject(recoObj)
//     })
// })

module.exports = router;



