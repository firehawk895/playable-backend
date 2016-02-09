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

var qbchat = require('./../qbchat.js');
var kew = require('kew')
var Firebase = require("firebase");
var firebaseRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.newMatches)
var date = new Date()

firebaseRef.child(constants.events.matches.created).on("child_added", function (snapshot) {
    var event = snapshot.val()
    if(isRecent(event.timestamp))
        customUtils.createRecommendationCron(newMatchObj.matchId, newMatchObj.playing_time)
})

function isRecent(timestamp) {
    if (date.getTime() > (now / 1000 - 60))
        return true
    else
        return false
}