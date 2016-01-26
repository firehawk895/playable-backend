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
            isEvent: true,
            //always false for an event
            isFacility: false,
            host: user
        }

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

module.exports = router;