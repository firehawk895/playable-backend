var express = require('express');
var router = express.Router();

var passport = require('passport');
customUtils = require('../utils.js');

var config = require('../config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

router.post('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var responseObj = {}
    var userId = req.user.results[0].value.id;

    var payload = {
        title: req.body.title,
        description: req.body.description,
        sport: req.body.sport,
        skill_level: req.body.skill_level,
        time: parseInt(req.body.time),
        slots: req.body.slots,
        location_name: req.body.location_name,
        location: {
            lat: parseFloat(req.body.lat),
            long: parseFloat(req.body.long)
        },
        isFacility: customUtils.stringToBoolean(req.body.isFacility),
        isEvent: customUtils.stringToBoolean(req.body.isEvent)
    }

    console.log(payload)

    db.post('matches', payload)
        .then(function(result) {
            console.log("ok wtf")
            payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];

            responseObj["data"] = payload;
            res.status(201);
            res.json(responseObj);

            db.newGraphBuilder()
                .create()
                .from('users', userId)
                .related('hosts')
                .to('matches', payload["id"]);

            db.newGraphBuilder()
                .create()
                .from('matches', payload["id"])
                .related('isHosted')//Every producer also consumes his course
                .to('users', userId);

            db.newGraphBuilder()
                .create()
                .from('users', userId)
                .related('related')
                .to('matches', payload["id"]);

        })
        .fail(function (err) {
            responseObj["errors"] = [err.body.message];
            res.status(422);
            res.json(responseObj);
        })

    //TODO: isFacility is true, set up graph relation and access codes
}])


router.get('/discover', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var date = new Date();
    var currentUnixTime = Math.round(date.getTime()/1000);
    var queries = new Array();
    var responseObj ={}

    var query ="value.time: " + currentUnixTime + "~*"  //this means greater than equalto
                                                    //https://orchestrate.io/docs/apiref#search
    queries.push(query)
    console.log(query)
    if(req.query.lat && req.query.long && req.query.radius) {
        console.log("we have a distance query")
        queries.push(customUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius))
    }

    if(req.query.sports) {
        console.log("we have a sports filter")
        var sportsArray = req.query.sports.split(',');
        queries.push(customUtils.createSportsQuery(sportsArray))
    }

    var theFinalQuery = customUtils.queryJoiner(queries)
    console.log("The final query")
    console.log(theFinalQuery)

    db.newSearchBuilder()
        .collection("matches")
        //.sort('location', 'distance:asc')
        .query(theFinalQuery)
        .then(function (results) {
            responseObj["total_count"] = results.body.total_count
            responseObj["data"] = customUtils.formatResults(results)
            res.status(200)
            res.json(responseObj)
        })
        .fail(function(err) {
            responseObj["error"] = [err.body.message]
            res.status(200)
            res.json(responseObj)
        })

}])

module.exports = router;