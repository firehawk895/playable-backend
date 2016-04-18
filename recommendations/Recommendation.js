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
var kew = require('kew')

/**
 * creates cron jobs that will create recommendations
 * for the participants of the match
 * @param matchId
 * @param playing_time
 */
function createRecommendationCron(matchId, playing_time) {
    //create new cron for the playing_time + constants.recommendation.dispatchTime
    //get all match participants
    //create recommendation objects for each user in firebase
    console.log("welcome to the jungle")
    console.log(matchId)
    console.log(playing_time)
    var matchPromise = MatchModel.getMatchPromise(matchId)
    var participantsPromise = MatchModel.getMatchParticipantsPromise(matchId)
    //
    kew.all([matchPromise, participantsPromise])
        .then(function (results) {
            console.log("the match details fetchhhhhhhhhh")
            var match = results[0].body
            var participants = dbUtils.injectId(results[1])
            console.log(participants)
            if (match.slots_filled == 2) {
                //1 on 1 match
                createRateYourOpponentReco(participants[0].id, participants[1].id, participants[1].name)
                createRateYourOpponentReco(participants[1].id, participants[0].id, participants[0].name)
            } else {
                //team match (more than 2 players)
                participants.forEach(function (participant) {
                    createRateTeamReco(participant.id, matchId, match.title)
                })
            }
            if (match.isFacility) {
                MatchModel.getFacilityOfMatchPromise(matchId)
                    .then(function (result) {
                        var results = dbUtils.injectId(result)
                        var facility = results[0]
                        console.log("the facility is")
                        console.log(facility)
                        
                        participants.forEach(function (participant) {
                            createRateFacilityReco(participant.id, facility.id, facility.name)
                        })
                    })
            }
        })
        .fail(function (err) {
            console.log("err")
            console.log(err)
        })
}

function createRateYourOpponentReco(fromUserId, toUserId, toUserName) {
    var payload = {
        'type': constants.recommendations.type.OneOnOne, //the type of Recommendation rating
        'message': 'Rate your opponent! Would you like to play with ' + toUserName + " again?",
        'isRated': false, //set to true once user has rated this
        'rating': constants.recommendations.rating.notPlayed, //front End will switch this to "thumbsUp" or "thumbsDown",
        fromUserId: fromUserId,
        'toUserId': toUserId
    }
    pushRecoToFirebase(payload, fromUserId)
}

function parseOneOnOneReco(recoObj) {
    rateUser(recoObj.rating, recoObj.toUserId)
    MatchModel.incrementMatchesPlayed(recoObj.fromUserId)
}

function createRateFacilityReco(fromUserId, toFacilityId, facilityName) {
    var payload = {
        'type': constants.recommendations.type.facility, //the type of Recommendation rating
        'message': 'How would you like to rate the facility ' + facilityName + "?",
        'isRated': false, //set to true once user has rated this
        'rating': constants.recommendations.rating.notPlayed, //front End will switch this to "thumbsUp" or "thumbsDown" or "notPlayed",
        fromUserId: fromUserId,
        toFacilityId: toFacilityId
    }
    pushRecoToFirebase(payload, fromUserId)
}

function parseFacilityReco(recoObj) {
    rateFacility(recoObj.rating, recoObj.toFacilityId)
}

function createRateTeamReco(fromUserId, toMatchId, toMatchName) {
    var payload = {
        'type': constants.recommendations.type.team, //the type of Recommendation rating
        'message': 'Rate the match "' + toMatchName + '"! Would you play with this team again?',
        'isRated': false, //set to true once user has rated this
        'rating': constants.recommendations.rating.notPlayed, //front End will switch this to "thumbsUp" or "thumbsDown" or "notPlayed",
        'toMatchId': toMatchId,
        'fromUserId': fromUserId
    }
    pushRecoToFirebase(payload, fromUserId)
}

function parseTeamReco(recoObj) {
    MatchModel.getMatchParticipantsPromise(recoObj.toMatchId)
        .then(function (results) {
            var participantIds = results.body.results.map(function (aResult) {
                return aResult.path.key
            })

            //If you've rated, you've played
            //because, you know, users are honest :)
            if (recoObj.rating != constants.recommendations.rating.notPlayed) {
                incrementMatchesPlayed(recoObj.fromUserId)
            }
            participantIds.splice(recoObj.fromUserId, 1)
            participantIds.forEach(function (participantId) {
                rateUser(recoObj.rating, participantId)
            })
        })
}

/**
 * Parse each recommendation marked by user
 * and do the needful updates
 * @param recoObj
 */
function parseRecObject(recoObj) {
    switch (recoObj.type) {
        case constants.recommendations.type.OneOnOne:
            parseOneOnOneReco(recoObj)
            break;
        case constants.recommendations.type.facility:
            parseFacilityReco(recoObj)
            break;
        case constants.recommendations.type.team:
            parseTeamReco(recoObj)
            break;
        default:
    }
}

function rateUser(rating, userId) {
    var payload = {}
    db.get('users', userId)
        .then(function (result) {
            var totalRatings = result.body.totalRatings
            var thumbsUps = result.body.thumbsUps
            var matchesPlayed = result.body.matchesPlayed

            if (rating == constants.recommendations.rating.thumbsUp) {
                payload = {
                    totalRatings: totalRatings + 1,
                    thumbsUps: thumbsUps + 1
                }
            } else if (rating == constants.recommendations.rating.thumbsDown) {
                payload = {
                    totalRatings: totalRatings + 1
                }
            }
            db.merge('users', userId, payload)
        })
}

function rateFacility(rating, facilityId) {
    var payload = {}
    MatchModel.getFacilityPromise(facilityId)
        .then(function (result) {
            var totalRatings = result.body.totalRatings
            var thumbsUps = result.body.thumbsUps
            var matchesPlayed = result.body.matchesPlayed

            if (rating == constants.recommendations.rating.thumbsUp) {
                payload = {
                    totalRatings: totalRatings + 1,
                    thumbsUps: thumbsUps + 1
                }
            } else if (rating == constants.recommendations.rating.thumbsDown) {
                payload = {
                    totalRatings: totalRatings + 1
                }
            }
            db.merge('facilities', facilityId, payload)
        })
}

/**
 * Push a recommendation to Firebase user tree
 * @param jsonPayload
 * @param userId
 */
function pushRecoToFirebase(jsonPayload, userId) {
    var newRecoRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.recommendations + "/" + userId)
    newRecoRef.child("data").push().set(jsonPayload)
    newRecoRef.child("count").transaction(function (current_value) {
        return (current_value || 0) + 1;
    });
}

module.exports = {
    createRecommendationCron: createRecommendationCron
}