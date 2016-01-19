var express = require('express');
var router = express.Router();

var passport = require('passport');
customUtils = require('../utils.js');

var config = require('../config.js');
//var config = require('../models/Match.js');
var matchValidation = require('../validations/Match.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var expressValidator = require('express-validator')
var customValidations = require('../customValidations')
//passport.authenticate('bearer', {session: false}),
router.post('/', [passport.authenticate('bearer', {session: false}), expressValidator(customValidations), function (req, res) {
    var responseObj = {}
    var user = req.user.results[0].value;
    var userId = req.user.results[0].value.id;
    //req.checkBody(matchValidation.postMatch)
    var validationResponse = matchValidation.validatePostMatch(req.body);

    req.body = validationResponse.reqBody
    var errors = validationResponse.errors

    if (errors.length > 0) {
        responseObj["errors"] = errors;
        res.status(422);
        res.json(responseObj);
    } else {
        var payload = {
            title: req.body.title,
            description: req.body.description,
            sport: req.body.sport,
            skill_level_min: req.body.skill_level_min,
            skill_level_max: req.body.skill_level_max,
            time: req.body.time,
            slots_filled: 0,
            slots: req.body.slots,
            location_name: req.body.location_name,
            location: {
                lat: req.body.lat,
                long: req.body.long
            },
            host: user,
            isFacility: req.body.isFacility,
            isEvent: req.body.isEvent
        }
        payload["host"]["password"] = undefined

        db.post('matches', payload)
            .then(function (result) {
                payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                responseObj["data"] = payload;
                res.status(201);
                res.json(responseObj);

                /**
                 * The numerous graph relations are so that we
                 * can access the related data from any entry point
                 */

                    //The user hosts the match
                customUtils.createGraphRelation('users', userId, 'matches', payload["id"], 'hosts')
                //The user plays in the match
                customUtils.createGraphRelation('users', userId, 'matches', payload["id"], 'plays')
                //The match is hosted by user
                customUtils.createGraphRelation('matches', payload["id"], 'users', userId, 'isHosted')
                //The match has participants (user)
                customUtils.createGraphRelation('matches', payload["id"], 'users', userId, 'participants')
            })
            .fail(function (err) {
                responseObj["errors"] = [err.body.message];
                res.status(422);
                res.json(responseObj);
            })
        //TODO: isFacility is true, set up graph relation and access codes
    }
}])

router.post('/join', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var matchId = req.body.matchId;
    var userId = req.user.results[0].value.id;
    var responseObj = {}

    db.get('matches', matchId)
        .then(function (result) {
            if (result.value.slots == result.value.slots_filled) {
                responseObj["error"] = ["The Match is already full. Please contact the host"]
                res.status(422)
                res.json(responseObj)
            } else {
                db.newGraphBuilder()
                    .create()
                    .from('users', userId)
                    .related('related')
                    .to('matches', matchId)
                    .then(function (result) {
                        /**
                         * You are hoping that orchestrate handles concurrency
                         * this sort of modification needs to be safe from race conditions
                         */
                        db.merge('matches', {
                            slots_filled: result.value.slots_filled + 1
                        })
                        customUtils.updateMatchConnections(userId, matchId)
                        responseObj["data"] = result
                        res.status(200)
                        res.json(responseObj)
                    })
                    .fail(function (err) {
                        responseObj["error"] = [err.body.message, "Could not join you into the match, Please try again later"]
                        res.status(200)
                        res.json(responseObj)
                    })
            }
        })
        .fail(function (err) {
            responseObj["error"] = [err.body.message]
            res.status(200)
            res.json(responseObj)
        })
}])

router.post('/invite', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var matchId = req.body.matchId
    var hostUserId = req.user.results[0].value.id
    var invitedUserId = req.body.invitedUserId
    var responseObj = {}

    db.get('matches', matchId)
        .then(function (result) {
            if (result.body.value.host.id != hostUserId) {
                responseObj["error"] = ["Only the host of the match can invite people"]
                res.status(403)
                res.json(responseObj)
            } else {
                customUtils.createGraphRelation('matches', matchId, 'users', invitedUserId, 'invitees')
                customUtils.createGraphRelation('users', invitedUserId, 'matches', matchId, 'invited')
                customUtils.createRequest('invitedToMatch', invitedUserId, matchId, hostUserId)
            }
        })
        .fail(function (err) {
            responseObj["error"] = [err.body.message]
            res.status(200)
            res.json(responseObj)
        })
}])


router.get('/discover', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var user = {}
    user.location = {
        'lat': req.user.results[0].value.location.lat,
        'long': req.user.results[0].value.location.long
    }
    var date = new Date();
    var currentUnixTime = Math.round(date.getTime() / 1000);
    var queries = new Array();
    var responseObj = {}

    var query = "value.time: " + currentUnixTime + "~*"  //this means greater than equalto
    //https://orchestrate.io/docs/apiref#search
    queries.push(query)
    console.log(query)
    var isDistanceQuery = false;

    if (req.query.lat && req.query.long && req.query.radius) {
        console.log("we have a distance query")
        queries.push(customUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius))
        isDistanceQuery = true;
    }

    if (req.query.sports) {
        console.log("we have a sports filter")
        var sportsArray = req.query.sports.split(',');
        queries.push(customUtils.createSportsQuery(sportsArray))
    }

    if (req.query.skill_level_min && req.query.skill_level_max) {
        console.log("we have a skill level filter")
        queries.push(customUtils.createSkillRatingQuery(req.query.skill_level_min, req.query.skill_level_max))
    }

    var theFinalQuery = customUtils.queryJoiner(queries)
    console.log("The final query")
    console.log(theFinalQuery)

    /**
     * remove sort by location if query does not have
     * location
     */
    if (isDistanceQuery) {
        db.newSearchBuilder()
            .collection("matches")
            .sort('location', 'distance:asc')
            .query(theFinalQuery)
            .then(function (results) {
                var distanceInjectedResults = customUtils.insertDistance(results, req.query.lat, req.query.long)
                responseObj["total_count"] = results.body.total_count
                responseObj["data"] = customUtils.injectId(distanceInjectedResults)
                res.status(200)
                res.json(responseObj)
            })
            .fail(function (err) {
                responseObj["error"] = [err.body.message]
                res.status(200)
                res.json(responseObj)
            })
    } else {
        db.newSearchBuilder()
            .collection("matches")
            //.sort('location', 'distance:asc')
            .query(theFinalQuery)
            .then(function (results) {
                responseObj["total_count"] = results.body.total_count
                responseObj["data"] = customUtils.injectId(results)
                res.status(200)
                res.json(responseObj)
            })
            .fail(function (err) {
                responseObj["error"] = [err.body.message]
                res.status(200)
                res.json(responseObj)
            })
    }
}])

module.exports = router;