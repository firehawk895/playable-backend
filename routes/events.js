var express = require('express');
var router = express.Router();

var multer = require('multer');
var passport = require('passport');
customUtils = require('../utils.js');

var config = require('../config.js');
//var config = require('../models/Match.js');
var validation = require('../validations/Match.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

router.post('/', [passport.authenticate('bearer', {session: false}), multer(), function (req, res) {
    var responseObj = {}
    var user = req.user.results[0].value;
    var userId = req.user.results[0].value.id;
    //req.checkBody(matchValidation.postMatch)
    var validationResponse = validation.validatePostEvent(req);

    req.body = validationResponse.reqBody
    req.files = validationResponse.reqFiles
    var errors = validationResponse.errors

    if (errors.length > 0) {
        responseObj["errors"] = errors;
        res.status(422);
        res.json(responseObj);
    } else {
        var payload = {
            title: req.body.title,
            sub_title: req.body.sub_title,
            description: req.body.description,
            sport: req.body.sport,
            skill_level_min: req.body.skill_level_min,
            skill_level_max: req.body.skill_level_max,
            playing_time: req.body.playing_time,
            slots_filled: 0,
            slots: req.body.slots,
            location_name: req.body.location_name,
            paid: req.body.paid,
            price: req.body.price,
            location: {
                lat: req.body.lat,
                long: req.body.long
            },
            google_form: req.body.google_form,
            type: "Event"
        }

        db.post('events', payload)
            .then(function (result) {
                payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                responseObj["data"] = payload;
                res.status(201);
                res.json(responseObj);
            })
            .fail(function (err) {
                responseObj["errors"] = [err.body.message];
                res.status(422);
                res.json(responseObj);
            })
        //TODO: isFacility is true, set up graph relation and access codes
    }
}])

router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    //var user = {}
    //user.location = {
    //    'lat': req.user.results[0].value.location.lat,
    //    'long': req.user.results[0].value.location.long
    //}
    var date = new Date();
    var currentUnixTime = Math.round(date.getTime() / 1000);
    var queries = new Array();
    var responseObj = {}

    //discover only upcoming events
    var query = "value.time: " + currentUnixTime + "~*"  //this means greater than equalto
    //https://orchestrate.io/docs/apiref#search
    queries.push(query)
    console.log(query)
    var isDistanceQuery = false;

    if (req.query.eventId) {
        console.log("we have a specific eventId query")
        queries.push(customUtils.createSearchByIdQuery(req.query.eventId))
    }

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
            .collection("events")
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
                responseObj["errors"] = [err.body.message]
                res.status(503)
                res.json(responseObj)
            })
    } else {
        db.newSearchBuilder()
            .collection("events")
            //.sort('location', 'distance:asc')
            .query(theFinalQuery)
            .then(function (results) {
                responseObj["total_count"] = results.body.total_count
                responseObj["data"] = customUtils.injectId(results)
                res.status(200)
                res.json(responseObj)
            })
            .fail(function (err) {
                responseObj["errors"] = [err.body.message]
                res.status(503)
                res.json(responseObj)
            })
    }
}])

module.exports = router;