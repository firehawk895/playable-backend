var express = require('express');
var router = express.Router();

var passport = require('passport');
var multer = require('multer');
var fs = require('fs');
var async = require('async')

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


router.post('/', [passport.authenticate('bearer', {session: false}), multer(), function (req, res) {
    var images = new Array()
    var responseObj = {}

    // 1st para in async.each() is the array of items
    async.each(req.files.image,
        // 2nd param is the function that each item is passed to
        function (theImage, callback) {
            // Call the asynchronous function
            customUtils.upload(theImage, function (theImageInS3) {
                images.push(theImageInS3)
                // Async call is done, alert via callback
                callback();
            })
        },
        // 3rd param is the function to call when everything's done
        function (err) {
            // All tasks are done now
            var payload = {
                sports : {
                    "badminton" : req.body.badminton,
                    "basketball" : req.body.basketball,
                    "bowling" : req.body.bowling,
                    "cricket" : req.body.cricket,
                    "cycling" : req.body.cycling,
                    "football" : req.body.football,
                    "golf" : req.body.golf,
                    "hockey" : req.body.hockey,
                    "pool" : req.body.pool,
                    "running" : req.body.running,
                    "snooker" : req.body.snooker,
                    "squash" : req.body.squash,
                    "swimming" : req.body.swimming,
                    "tennis" : req.body.tennis,
                    "tt" : req.body.tt,
                    "ultimatefrisbee" : req.body.ultimatefrisbee
                },
                timings : req.body.timings,
                contactEmail : req.body.contactEmail,
                contactNumber: req.body.contactNumber,
                name: req.body.name,
                location_name: req.body.location_name,
                location: {
                    lat: req.body.lat,
                    long: req.body.long
                },
                description: req.body.description,
                images: images,
                totalRatings: 0,
                thumbsUps: 0
            }
            db.post('facilities', payload)
                .then(function (result) {
                    payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                    responseObj["data"] = payload
                    res.status(201);
                    res.json(responseObj);
                })
                .fail(function (err) {
                    responseObj["errors"] = [err.body.message]
                    res.status(503);
                    res.json(responseObj);
                })
        }
    );
}])

router.patch('/', [passport.authenticate('bearer', {session: false}), multer(), function (req, res) {
    var images = new Array()
    var responseObj = {}
    var facilityId = req.query.facilityId

    // 1st para in async.each() is the array of items
    async.each(req.files.image,
        // 2nd param is the function that each item is passed to
        function (theImage, callback) {
            // Call the asynchronous function
            customUtils.upload(theImage, function (theImageInS3) {
                images.push(theImageInS3)
                // Async call is done, alert via callback
                callback();
            })
        },
        // 3rd param is the function to call when everything's done
        function (err) {
            // All tasks are done now
            var sanitziedPayload = {
                sports : {
                    "badminton" : req.body.badminton,
                    "basketball" : req.body.basketball,
                    "bowling" : req.body.bowling,
                    "cricket" : req.body.cricket,
                    "cycling" : req.body.cycling,
                    "football" : req.body.football,
                    "golf" : req.body.golf,
                    "hockey" : req.body.hockey,
                    "pool" : req.body.pool,
                    "running" : req.body.running,
                    "snooker" : req.body.snooker,
                    "squash" : req.body.squash,
                    "swimming" : req.body.swimming,
                    "tennis" : req.body.tennis,
                    "tt" : req.body.tt,
                    "ultimatefrisbee" : req.body.ultimatefrisbee
                },
                timings : req.body.timings,
                contactEmail : req.body.contactEmail,
                contactNumber: req.body.contactNumber,
                name: req.body.name,
                location_name: req.body.location_name,
                location: {
                    lat: req.body.lat,
                    long: req.body.long
                },
                description: req.body.description,
                images: images,
                totalRatings: 0,
                thumbsUps: 0
            }
            db.merge('facilities', facilityId, sanitziedPayload)
                .then(function (result) {
                    payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                    responseObj["data"] = payload
                    res.status(201);
                    res.json(responseObj);
                })
                .fail(function (err) {
                    responseObj["errors"] = [err.body.message]
                    res.status(503);
                    res.json(responseObj);
                })
        }
    );
}])

router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var responseObj = {}
    var queries = []

    queries.push("@path.kind:item")
    if (req.query.facilityId) {
        console.log("we have a specific facilityId query")
        queries.push(dbUtils.createSearchByIdQuery(req.query.facilityId))
    }

    var theFinalQuery = dbUtils.queryJoiner(queries)

    db.newSearchBuilder()
        .collection("facilities")
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
}])


//async.each(req.files.image, function (image, callback), function (err) {
//    console.log("kuch hua kya")
//    console.log(err)
//var payload = {
//    name: req.body.name,
//    location_name: req.body.location_name,
//    location: {
//        lat: req.body.lat,
//        long: req.body.long
//    },
//    description: req.body.description,
//    images: images
//}
//
//db.post('facilities', payload)
//    .then(function (result) {
//        payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
//        responseObj["data"] = payload
//        res.status(201);
//        res.json(responseObj);
//    })


module.exports = router;