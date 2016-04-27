var express = require('express');
var router = express.Router();

var passport = require('passport');
var customUtils = require('../utils');
var constants = require('../constants');
var RecommendationModel = require('../recommendations/Recommendation');

var config = require('./../config.js');
//var config = require('../models/Match.js');
var matchValidation = require('./../validations/Match.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var kew = require('kew')
var Firebase = require("firebase");
var newMatchesRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.events.newMatches)
// var recommendationsRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.recommendations)

console.log("recommendations loaded")
/**
 * listener:
 * new matches created
 */
newMatchesRef.on("child_added", function (childSnapshot, prevChildKey) {
    try {
        /**
         * dispatch recommendations rating requests for each user
         */
        var newMatchObj = childSnapshot.val()
        console.log(newMatchObj.eventTimeStamp)

        // if(customUtils.isRecent(newMatchObj.eventTimeStamp)) {
        // RecommendationModel.createRecommendationCron(newMatchObj.id, newMatchObj.playing_time)
        // }
        customUtils.createRecommendationCron(newMatchObj.matchId, newMatchObj.playing_time)
    } catch (e) {
        console.log("swallowing e haha")
        console.log("swallowing e haha")
        console.log(e)
    }
})

module.exports = router;



