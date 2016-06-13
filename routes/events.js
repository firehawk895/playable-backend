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
var customUtils = require('../utils')

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
            slots: req.body.slots,
            location_name: req.body.location_name,
            paid: req.body.paid,
            price: req.body.price,
            priceText: req.body.priceText,
            location: {
                lat: req.body.lat,
                long: req.body.long
            },
            google_form: req.body.google_form,
            isFeatured: customUtils.stringToBoolean(req.body.isFeatured),
            isDiscoverable: true,
            type: "Event"
        }

        customUtils.upload(req.files.image, function (coverPhotoInfo) {
            payload["coverPhoto"] = coverPhotoInfo.url
            payload["coverPhotoThumb"] = coverPhotoInfo.urlThumb
            db.post('events', payload)
                .then(function (result) {
                    console.log("hey")
                    payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                    //EventModel.dispatchEvent(constants.event.events.created, payload)
                    //someday, I think this should be decoupled
                    console.log(payload["id"])
                    console.log(payload["title"])
                    EventSystem.newEvent(payload["id"], payload["title"])
                    responseObj["data"] = payload;
                    res.status(201);
                    res.json(responseObj);
                })
                .fail(function (err) {
                    customUtils.sendErrors(err, res)
                })
        })
    }
}])

router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var limit = req.query.limit || 100
    var page = req.query.page || 1
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


    if (req.query.eventId) {
        isEventQuery = true
        console.log("we have a specific eventId query")
        queries.push(dbUtils.createSearchByIdQuery(req.query.eventId))
    } else {
        console.log("default time and isDiscoverable query")
        queries.push(MatchModel.createIsDiscoverableQuery())

        if (req.query.isFeatured == "true")
            queries.push(EventModel.createFeaturedQuery())
        else
            queries.push(EventModel.createNotFeaturedQuery())


        // var isDistanceQuery = false;

        // if (req.query.featured == "false") {
        //
        // } else {
        //     console.log("featured query")
        //     queries.push(dbUtils.createFieldQuery("isFeatured", "true"))
        // }
    }

    if (req.query.showAll)
        queries = ["@path.kind:item"]


    // if (req.query.lat && req.query.long && req.query.radius) {
    //     console.log("we have a distance query")
    //     queries.push(dbUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius))
    //     isDistanceQuery = true;
    // }

    var theFinalQuery = dbUtils.queryJoiner(queries)
    console.log("The final query")
    console.log(theFinalQuery)

    /**
     * remove sort by location if query does not have
     * location
     */
    // if (isDistanceQuery) {
    //     var distanceQuery = db.newSearchBuilder()
    //         .collection("events")
    //         .limit(limit)
    //         .offset(offset)
    //         .sort('location', 'distance:asc')
    //         .query(theFinalQuery)
    //     promises.push(distanceQuery)
    // } else {
    var distanceLessQuery = db.newSearchBuilder()
        .collection("events")
        .limit(limit)
        .offset(offset)
        .sortBy("@path.reftime:desc")
        //.sort('location', 'distance:asc')
        .query(theFinalQuery)
    promises.push(distanceLessQuery)
    // }

    //push event participants
    if (isEventQuery) {
        promises.push(EventModel.getEventParticipantsPromise(req.query.eventId))
    } else {
        promises.push(kew.resolve([]))
    }

    var theMasterResults
    kew.all(promises)
        .then(function (results) {
            //results[0] is the main query
            //results[1] is the event participants query
            theMasterResults = results
            //inject isJoined
            return MatchModel.injectIsJoined(theMasterResults[0], userId)
        })
        .then(function (results) {
            // if (distanceQuery) {
            //     results = MatchModel.insertDistance(results, req.query.lat, req.query.long)
            // }
            responseObj["total_count"] = results.body.total_count
            responseObj["data"] = dbUtils.injectId(results)
            if (isEventQuery) {
                var eventParticipants = dbUtils.injectId(theMasterResults[1])
                responseObj["players"] = eventParticipants
            }
            res.status(200)
            res.json(responseObj)
        })
        .fail(function (err) {
            customUtils.sendErrors(err, res)
        })
}])

router.post('/join', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var eventId = req.body.eventId;
    var userId = req.user.results[0].value.id;
    var responseObj = {}

    if (req.query.paymentId && req.query.amount) {
        customUtils.captureRazorPayment(req.query.paymentId, req.query.amount)
            .then(function (result) {
                return EventModel.joinEvent(userId, eventId)
            })
            .then(function (result) {
                responseObj["data"] = []
                res.status(200)
                res.json(responseObj)
            })
            .fail(function (err) {
                customUtils.sendErrors(err, res)
            })
    } else {
        EventModel.joinEvent(userId, eventId)
            .then(function (result) {
                responseObj["data"] = []
                res.status(200)
                res.json(responseObj)
            })
            .fail(function (err) {
                customUtils.sendErrors(err, res)
            })
    }
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
                isFeatured: req.body.isFeatured,
                isDiscoverable: req.body.isDiscoverable,
                google_form: req.body.google_form,
                note: req.body.note //TODO : limit the length so this field cannot be exploited
            }

            if (coverPhotoInfo) {
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
                    customUtils.sendErrors(err, res)
                })
        })
    }
}])

router.get('/csv', function (req, res) {
    dbUtils.generateCsvFile("events", "@path.kind:item")
        .then(function (result) {
            res.status(200)
            res.sendFile('eventa.csv', {root: path.join(__dirname, '../csv')});
        })
        .fail(function (err) {
            customUtils.sendErrors(err, res)
        })
})

router.delete('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    console.log("delete event")
    var id = req.query.id

    console.log("being deleted -- " + id)

    db.remove('events', id, true)
        .then(function (result) {
            res.status(200);
            res.json({data: {}, msg: "Delete successful"});
        })
        .fail(function (err) {
            customUtils.sendErrors(err, res)
        })
}])

module.exports = router;