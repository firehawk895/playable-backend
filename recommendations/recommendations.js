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
var recommendationsRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.recommendations)

console.log("recommendations loaded")
// RecommendationModel.createRecommendationCron("11a8b7494b60a63b", "1464640883000")

/**
 * listener:
 * new matches created
 */
// newMatchesRef.on("child_added", function (childSnapshot, prevChildKey) {
//     try {
//         /**
//          * dispatch recommendations rating requests for each user
//          */
//         var newMatchObj = childSnapshot.val()
//         console.log(newMatchObj.eventTimeStamp)
//
//         if (customUtils.isRecent(newMatchObj.eventTimeStamp)) {
//             RecommendationModel.createRecommendationCron(newMatchObj.id, newMatchObj.playing_time)
//         }
//     } catch (e) {
//         console.log("swallowing e haha")
//         console.log(e)
//     }
// })

/**
 * listener:
 * user gives a rating, do the needful actions
 */
recommendationsRef.on("child_added", function (childSnapshot, prevChildKey) {
    var userId = childSnapshot.key()
    console.log("hello")
    var userRecoPath = config.firebase.url + "/" + constants.firebaseNodes.recommendations + "/" + userId + "/data"
    var userRecoRef = new Firebase(userRecoPath, config.firebase.secret)
    /**
     * Register a child_changed listener for one user's request
     * */
    userRecoRef.child("/").on("child_changed", function (childSnapshot, prevChildKey) {
        console.log("child_changed of recommendation")
        var recObject = childSnapshot.val()

        if (recObject.isRated == true && recObject.backendParsed == false) {
            console.log("recommendation status changed... parsing it up")
            RecommendationModel.parseRecObject(recObject)
            RecommendationModel.updateBackendParsed(userRecoPath + "/" + childSnapshot.key())
        }
    })
})

module.exports = router;



