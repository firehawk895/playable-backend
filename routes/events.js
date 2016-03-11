var express = require('express');
var router = express.Router();

var multer = require('multer');
var passport = require('passport');
customUtils = require('../utils.js');

//var config = require('../models/Match.js');
var validation = require('../validations/Match.js');

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
            playing_time: req.body.playing_time,
            lastRegDate: req.body.lastRegDate,
            contactUs: req.body.contactUs,
            slots_filled: 0,
            //slots: req.body.slots,
            location_name: req.body.location_name,
            paid: req.body.paid,
            price: req.body.price,
            priceText: req.body.priceText,
            location: {
                lat: req.body.lat,
                long: req.body.long
            },
            google_form: req.body.google_form,
            type: "Event"
        }

        customUtils.upload(req.files.image, function (coverPhotoInfo) {
            console.log(coverPhotoInfo)
            payload["coverPhoto"] = coverPhotoInfo.url
            payload["coverPhotoThumb"] = coverPhotoInfo.urlThumb
            db.post('events', payload)
                .then(function (result) {
                    payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                    EventModel.dispatchEvent(constants.event.events.created, payload)
                    responseObj["data"] = payload;
                    res.status(201);
                    res.json(responseObj);
                })
                .fail(function (err) {
                    responseObj["errors"] = [err.body.message];
                    res.status(422);
                    res.json(responseObj);
                })
        })
    }
}])

router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    //var user = {}
    //user.location = {
    //    'lat': req.user.results[0].value.location.lat,
    //    'long': req.user.results[0].value.location.long
    //}
    var queries = new Array();
    var responseObj = {}

    console.log("the future query : " + MatchModel.createOnlyFutureTypeQuery())
    queries.push(MatchModel.createOnlyFutureTypeQuery())
    var isDistanceQuery = false;

    if (req.query.eventId) {
        console.log("we have a specific eventId query")
        queries.push(dbUtils.createSearchByIdQuery(req.query.eventId))
    }

    if (req.query.lat && req.query.long && req.query.radius) {
        console.log("we have a distance query")
        queries.push(dbUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius))
        isDistanceQuery = true;
    }

    var theFinalQuery = dbUtils.queryJoiner(queries)
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
                var distanceInjectedResults = MatchModel.insertDistance(results, req.query.lat, req.query.long)
                responseObj["total_count"] = results.body.total_count
                responseObj["data"] = dbUtils.injectId(distanceInjectedResults)
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
                responseObj["data"] = dbUtils.injectId(results)
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

router.post('/join', [passport.authenticate('bearer', {session: false}), function (req, res) {
    console.log("definitely here")
    var eventId = req.body.eventId;
    var userId = req.user.results[0].value.id;
    var responseObj = {}

    db.get('events', eventId)
        .then(function (theEvent) {
            console.log(theEvent.body)
            console.log("what")
            //Check if he has already joined the match
            EventModel.checkEventParticipationPromise(eventId, userId)
                .then(function (results) {
                    console.log(results.body)
                    console.log("just checked event participation")
                    var count = results.body.count
                    if (count == 0) {
                        console.log("user determined to be not participating in event")
                        //qbchat.addUserToRoom(roomId, [userId], function (err, result) {
                        //    if (err) {
                        //        console.log(err)
                        //        customUtils.sendErrors(["Couldn't join you into the match's chat room"], 503, res)
                        //    } else {
                        dbUtils.createGraphRelation('events', eventId, 'users', userId, 'participants')
                        //customUtils.incrementMatchesPlayed(userId)
                        db.newGraphBuilder()
                            .create()
                            .from('users', userId)
                            .related('plays')
                            .to('events', eventId)
                            .then(function (result) {
                                /**
                                 * You are hoping that orchestrate handles concurrency
                                 * this sort of modification needs to be safe from race conditions
                                 */
                                //console.log(theEvent.body.slots_filled)
                                //var slots = theEvent.body.slots
                                //var slotsFilled = theEvent.body.slots_filled + 1
                                //var payload = {
                                //    'slots_filled': slotsFilled
                                //}

                                //if match is full make it undiscoverable
                                //if (slots == slotsFilled) {
                                //    payload["isDiscoverable"] = false
                                //}
                                //db.merge('events', eventId, payload)
                                //customUtils.updateMatchConnections(userId, matchId)

                                responseObj["data"] = []
                                responseObj["message"] = "Successfully joined"
                                res.status(200)
                                res.json(responseObj)
                            })
                            .fail(function (err) {
                                responseObj["errors"] = [err.body.message, "Could not join you into the Event, Please try again later"]
                                res.status(503)
                                res.json(responseObj)
                            })
                        //}
                        //})
                    } else {
                        customUtils.sendErrors(["You are already part of this event"], 422, res)
                    }
                })
            //}
        })
        .fail(function (err) {
            responseObj["errors"] = [err.body.message]
            res.status(503)
            res.json(responseObj)
        })
}
])

module.exports = router;