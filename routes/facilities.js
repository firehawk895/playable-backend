var express = require('express');
var router = express.Router();

var passport = require('passport');
var multer = require('multer');
var fs = require('fs');
customUtils = require('../utils.js');

var config = require('../config.js');
var async = require('async')
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);


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
                name: req.body.name,
                location_name: req.body.location_name,
                location: {
                    lat: req.body.lat,
                    long: req.body.long
                },
                description: req.body.description,
                images: images
            }
            db.post('facilities', payload)
                .then(function (result) {
                    payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                    responseObj["data"] = payload
                    res.status(201);
                    res.json(responseObj);
                })
                .fail(function(err) {
                    responseObj["errors"] = [err.body.message]
                    res.status(201);
                    res.json(responseObj);
                })
        }
    );
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