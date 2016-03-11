var express = require('express');
var router = express.Router();

var passport = require('passport');
var multer = require('multer');
var fs = require('fs');
var async = require('async')

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
var EventSystem = require(__base + './events/events');;


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
                //sports : req.body.sports,
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

router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var responseObj = {}
    db.newSearchBuilder()
        .collection("facilities")
        //.sort('location', 'distance:asc')
        .query("*")
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