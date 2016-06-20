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
var path = require('path')


router.post('/', [passport.authenticate('bearer', {session: false}), multer(), function (req, res) {
    var images = []
    var responseObj = {}
    
    console.log("files array : ")
    console.log(req.files.image)
    
    if(!isArray(req.files.image))
        req.files.image = [req.files.image]
        

    console.log("raw payload : ")
    console.log(req.body)

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
                    "tabletennis" : req.body.tabletennis,
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

            console.log("the payload modified : ")
            console.log(payload)

            db.post('facilities', payload)
                .then(function (result) {
                    payload["id"] = dbUtils.getIdAfterPost(result);
                    responseObj["data"] = payload
                    res.status(201);
                    res.json(responseObj);
                })
                .fail(function (err) {
                    customUtils.sendErrors(err, res)
                })
        }
    );
}])

router.patch('/', [passport.authenticate('bearer', {session: false}), multer(), function (req, res) {

    console.log("files array : ")
    console.log(req.files.image)
    
    
    if(!isArray(req.files.image))
        req.files.image = [req.files.image]
    
    var images = []
    var responseObj = {}
    var facilityId = req.query.facilityId
    var payload

    console.log("raw payload : ")
    console.log(req.body)
    
    if(!req.files.image)
        req.files.image = []

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
                    "badminton" : (req.body.badminton || null),
                    "basketball" : (req.body.basketball || null),
                    "bowling" : (req.body.bowling || null),
                    "cricket" : (req.body.cricket || null),
                    "cycling" : (req.body.cycling || null),
                    "football" : (req.body.football || null),
                    "golf" : (req.body.golf || null),
                    "hockey" : (req.body.hockey || null),
                    "pool" : (req.body.pool || null),
                    "running" : (req.body.running || null),
                    "snooker" : (req.body.snooker || null),
                    "squash" : (req.body.squash || null),
                    "swimming" : (req.body.swimming || null),
                    "tennis" : (req.body.tennis || null),
                    "tabletennis" : (req.body.tabletennis || null),
                    "ultimatefrisbee" : (req.body.ultimatefrisbee || null)
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
            
            console.log("payload after sanitization : ")
            console.log(sanitziedPayload)
            
            db.merge('facilities', facilityId, sanitziedPayload)
                .then(function (result) {
                    sanitziedPayload["id"] = dbUtils.getIdAfterPost(result)
                    responseObj["data"] = sanitziedPayload
                    res.status(201);
                    res.json(responseObj);
                })
                .fail(function (err) {
                    customUtils.sendErrors(err, res)
                })
        }
    );
}])

router.get('/csv', function (req, res) {
    dbUtils.generateCsvFile("facilities", "@path.kind:item")
        .then(function (result) {
            res.status(200)
            res.sendFile('facilities.csv', {root: path.join(__dirname, '../csv')});
        })
        .fail(function (err) {
            customUtils.sendErrors(err, res)
        })
})

router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    console.log("get facilities")
    var limit = req.query.limit || 100
    var page =  req.query.page || 1
    var offset = limit * (page - 1)
    
    console.log(limit)
    console.log(offset)
    
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
        .limit(limit)
        .offset(offset)
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

router.get('/csv', function(req, res) {
    dbUtils.generateCsvFile("facilities", "@path.kind:item")
        .then(function(result) {
            res.status(200)
            res.sendFile('facilities.csv', {root: path.join(__dirname, '../csv')});
        })
        .fail(function(err) {
            customUtils.sendErrors(err, res)
        })
})

router.delete('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    console.log("delete facility")
    var id = req.query.id

    db.remove('facilities', id, true)
        .then(function(result) {
            res.status(200);
            res.json({data:{}, msg : "Delete successful"});
        })
        .fail(function(err) {
            console.log("Error")
            console.log(err)
            customUtils.sendErrors(err, res)
        })
}])

module.exports = router;