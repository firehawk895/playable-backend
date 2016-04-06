var express = require('express');
var router = express.Router();

var multer = require('multer');
var passport = require('passport');
customUtils = require('../utils.js');

//var config = require('../models/Match.js');
var matchValidation = require('../validations/Match.js');

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
var kew = require('kew');
var dbUtils = require('../dbUtils');
var EventSystem = require('../notifications/dispatchers');

router.post('/', [passport.authenticate('bearer', {session: false}), multer(), function (req, res) {
    //TODO : move this to the model class
    var responseObj = {}
    var user = req.user.results[0].value;
    var userId = req.user.results[0].value.id;
    //req.checkBody(matchValidation.postMatch)
    var validationResponse = matchValidation.validatePostEvent(req);

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

        console.log("yaha")
        customUtils.upload(req.files.image, function (coverPhotoInfo) {
            console.log(coverPhotoInfo)
            payload["coverPhoto"] = coverPhotoInfo.url
            payload["coverPhotoThumb"] = coverPhotoInfo.urlThumb
            db.post('events', payload)
                .then(function (result) {
                    console.log("kaha")
                    payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                    //EventModel.dispatchEvent(constants.event.events.created, payload)
                    //someday, I think this should be decoupled
                    console.log("ssup")
                    EventSystem.newEvent(payload["id"], payload["title"])
                    console.log("made it past nofs")
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
    var limit = 100 || req.query.limit
    var page = 1 || req.query.page
    var offset = limit * (page - 1)

    var userId = req.user.results[0].value.id

    var promises = []
    var isEventQuery = false
    
    //var user = {}
    //user.location = {
    //    'lat': req.user.results[0].value.location.lat,
    //    'long': req.user.results[0].value.location.long
    //}
    var queries = []
    var responseObj = {}

    console.log("the future query : " + MatchModel.createOnlyFutureTypeQuery())
    queries.push(MatchModel.createOnlyFutureTypeQuery())
    var isDistanceQuery = false;

    if (req.query.eventId) {
        isEventQuery = true
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
        var distanceQuery = db.newSearchBuilder()
            .collection("events")
            .limit(limit)
            .offset(offset)
            .sort('location', 'distance:asc')
            .query(theFinalQuery)
            // .then(function (results) {
            //     var distanceInjectedResults = MatchModel.insertDistance(results, req.query.lat, req.query.long)
            //     responseObj["total_count"] = results.body.total_count
            //     responseObj["data"] = dbUtils.injectId(distanceInjectedResults)
            //     res.status(200)
            //     res.json(responseObj)
            // })
            // .fail(function (err) {
            //     responseObj["errors"] = [err.body.message]
            //     res.status(503)
            //     res.json(responseObj)
            // })
        promises.push(distanceQuery)
    } else {
        var distanceLessQuery = db.newSearchBuilder()
            .collection("events")
            .limit(limit)
            .offset(offset)
            //.sort('location', 'distance:asc')
            .query(theFinalQuery)
            // .then(function (results) {
            //     responseObj["total_count"] = results.body.total_count
            //     responseObj["data"] = dbUtils.injectId(results)
            //     res.status(200)
            //     res.json(responseObj)
            // })
            // .fail(function (err) {
            //     responseObj["errors"] = [err.body.message]
            //     res.status(503)
            //     res.json(responseObj)
            // })
        promises.push(distanceLessQuery)
    }

    //push event participants
    if (isEventQuery) {
        promises.push(EventModel.getEventParticipantsPromise(req.query.eventId))
    } else {
        promises.push(kew.resolve([]))
    }

    var theMasterResults
    kew.all(promises)
        .then(function(results) {
            //results[0] is the main query
            //results[1] is the event participants query
            theMasterResults = results
            //inject isJoined
            return MatchModel.injectIsJoined(theMasterResults[0], userId)
        })
        .then(function (results) {
            if (distanceQuery) {
                results = MatchModel.insertDistance(results, req.query.lat, req.query.long)
            }
            responseObj["total_count"] = results.body.total_count
            responseObj["data"] = dbUtils.injectId(results)
            if (isEventQuery) {
                var eventParticipants = dbUtils.injectId(theMasterResults[2])
                responseObj["players"] = eventParticipants
            }
            res.status(200)
            res.json(responseObj)
        })
        .fail(function(err) {
            customUtils.sendErrors([err.body.message], 503, res)
        })
}])

router.post('/join', [passport.authenticate('bearer', {session: false}), function (req, res) {
    console.log("definitely here")
    var eventId = req.body.eventId;
    var userId = req.user.results[0].value.id;
    var responseObj = {}

    EventModel.joinEvent(userId, eventId)
        .then(function (result) {
            responseObj["data"] = []
            res.status(200)
            res.json(responseObj)
        })
        .fail(function (err) {
            responseObj["errors"] = [JSON.stringify(err)]
            res.status(503)
            res.json(responseObj)
        })
}])

router.patch('/', [passport.authenticate('bearer', {session: false}), multer(), function (req, res) {
    var responseObj = {}
    var user = req.user.results[0].value
    var eventId = req.query.id
    var invitedUsersIds = req.body.invitedUserIds

    var validationResponse = matchValidation.validatePatchEvent(req);
    req.body = validationResponse.reqBody
    req.files = validationResponse.reqFiles
    var errors = validationResponse.errors

    if (errors.length > 0) {
        responseObj["errors"] = errors;
        res.status(422);
        res.json(responseObj);
    } else {
        customUtils.upload(req.files.image, function (coverPhotoInfo) {
            var sanitizedPayload = {
                title: req.body.title,
                sub_title: req.body.sub_title,
                description: req.body.description,
                playing_time: req.body.playing_time,
                lastRegDate: req.body.lastRegDate,
                contactUs: req.body.contactUs,
                slots_filled: 0,
                location_name: req.body.location_name,
                paid: req.body.paid,
                price: req.body.price,
                priceText: req.body.priceText,
                location: {
                    lat: req.body.lat,
                    long: req.body.long
                },
                google_form: req.body.google_form,
                note: req.body.note //TODO : limit the length so this field cannot be exploited
            }

            if(coverPhotoInfo) {
                sanitizedPayload.coverPhoto = coverPhotoInfo.url
                sanitizedPayload.coverPhotoThumb = coverPhotoInfo.urlThumb
            }

            console.log(sanitizedPayload)

            db.merge('events', eventId, sanitizedPayload)
                .then(function (result) {
                    return db.get('events', eventId)
                })
                .then(function (theEvent) {
                    responseObj["data"] = theEvent.body;
                    res.status(201);
                    res.json(responseObj);
                })
                .fail(function (err) {
                    customUtils.sendErrors([err.body.message], 503, res)
                })
        })
    }
}])

router.delete('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    console.log("delete event")
    var id = req.query.id
    
    console.log("being deleted -- " + id)

    db.remove('events', id, true)
        .then(function(result) {
            console.log(result.headers)
            res.status(200);
            res.json({data:{}, msg : "Delete successful"});
        })
        .fail(function(err) {
            console.log("Error")
            console.log(err)
            customUtils.sendErrors([err.body.message], 503, res)
        })
}])

module.exports = router;