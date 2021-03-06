var express = require('express');
var router = express.Router();

var passport = require('passport');
var request = require('request');

var multer = require('multer');
var customUtils = require('../utils')
var MatchModel = require('../models/Match')

// var Notifications = require('../notifications');
// var notify = new Notifications();

var config = require('../config.js');

var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

// var now = new Date().getTime()

var Firebase = require("firebase");
var feedbackRefUrl = config.firebase.url + "/FeedbackUpdated"

var userRef = new Firebase(feedbackRefUrl, config.firebase.secret);

// var EventSystem = require('../notifications/dispatchers');
var dbUtils = require('../dbUtils')
var kew = require('kew')

router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var userId = req.user.results[0].value.id
    var limit = req.query.limit || 100
    var query = req.query.query || ""

    //http://stackoverflow.com/questions/4374822/javascript-regexp-remove-all-special-characters#
    //remove all special characters
    query = query.replace(/[^\w\s]/gi, '')
    console.log("sanitized query : " + query)

    //if the query has a space, escape it, because lucene behaves weirdly!
    //https://dismantledtech.wordpress.com/2011/05/15/handling-spaces-in-lucene-wild-card-searches/#comment-229
    /**
     * Excerpt :
     * I tried to get around the issue using quotes, but to no avail –
     * a search term like ‘”SFP YGF”*’ isn’t parsed in the way that you’d expect,
     * and doesn’t produce the desired effect.
     * Adding a backslash makes the query parser interpret
     * the space character as being part of the search term,
     * and so a search for something like ‘SFP\ YGF\:\ FGY’ will return
     * everything that beings with the string “SFP YGP: FGY”.
     */

    var spaceEscapedQuery = query.replace(/\s/g, '\\ ')
    var spaceRemovedQuery = query.replace(/ /g, '')
    console.log("space escaped query")
    console.log(spaceEscapedQuery)

    var matchQueries = [
        dbUtils.createFuzzyQuery("title", spaceEscapedQuery),
        dbUtils.createFuzzyQuery("description", spaceEscapedQuery),
        dbUtils.createFuzzyQuery("sport", spaceEscapedQuery),
        dbUtils.createFuzzyQuery("location_name", spaceEscapedQuery),
        dbUtils.createFuzzyQuery("host.name", spaceEscapedQuery),
    ]

    var playerQueries = [
        dbUtils.createFuzzyQuery("name", spaceEscapedQuery),
        dbUtils.createFuzzyQuery("sports", spaceEscapedQuery),
        dbUtils.createExistsQuery("value.sports." + spaceRemovedQuery)
    ]

    var eventQueries = [
        dbUtils.createFuzzyQuery("title", spaceEscapedQuery),
        dbUtils.createFuzzyQuery("sub_title", spaceEscapedQuery),
        dbUtils.createFuzzyQuery("description", spaceEscapedQuery)
    ]

    var finalMatchQuery = dbUtils.queryJoinerOr(matchQueries)
    var finalPlayerQuery = dbUtils.queryJoinerOr(playerQueries)
    var finalEventQuery = dbUtils.queryJoinerOr(eventQueries)

    var isDistanceQuery = false
    if (req.query.lat && req.query.long && req.query.radius) {
        finalMatchQuery =
            dbUtils.queryJoiner([
                finalMatchQuery,
                dbUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius)
            ])
        finalPlayerQuery =
            dbUtils.queryJoiner([
                finalPlayerQuery,
                dbUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius)
            ])
        finalEventQuery =
            dbUtils.queryJoiner([
                finalEventQuery,
                dbUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius)
            ])
        console.log("we have a distance query")
        isDistanceQuery = true;
    }

    var promises = []
    if (isDistanceQuery) {
        promises = [
            db.newSearchBuilder()
                .collection('matches')
                .limit(limit)
                .offset(0)
                .sort('location', 'distance:asc')
                .query(finalMatchQuery),
            db.newSearchBuilder()
                .collection('users')
                .limit(limit)
                .offset(0)
                .sort('location', 'distance:asc')
                .query(finalPlayerQuery),
            db.newSearchBuilder()
                .collection('events')
                .limit(limit)
                .offset(0)
                .sort('location', 'distance:asc')
                .query(finalEventQuery),
        ]
    } else {
        /**
         * remove sort by location if query does not have
         * location. the orchestrate query won't work otherwise
         */
        promises = [
            db.newSearchBuilder()
                .collection('matches')
                .limit(limit)
                .offset(0)
                .query(finalMatchQuery),
            db.newSearchBuilder()
                .collection('users')
                .limit(limit)
                .offset(0)
                .query(finalPlayerQuery),
            db.newSearchBuilder()
                .collection('events')
                .limit(limit)
                .offset(0)
                .query(finalEventQuery),
        ]
    }

    kew.all(promises)
        .then(function (results) {
            return kew.all([
                MatchModel.injectIsJoined(results[0], userId),
                kew.resolve(results[1]),
                MatchModel.injectIsJoined(results[2], userId)
            ])
        })
        .then(function (results) {
            if (isDistanceQuery) {
                results = results.map(function(resultSet) {
                    resultSet = MatchModel.insertDistance(resultSet, req.query.lat, req.query.long)
                    return resultSet
                })
            }
            var response = {
                "matches": dbUtils.injectId(results[0]),
                "players": dbUtils.injectId(results[1]),
                "events": dbUtils.injectId(results[2])
            }
            res.send(response)
            res.status(200)
        })
        .fail(function (err) {
            customUtils.sendErrors(err, res)
        })
}])

router.get('/facilities', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var query = req.query.query || ""

    //refer above API for details on sanitization and escape parameters
    query = query.replace(/[^\w\s]/gi, '')
    console.log("sanitized query : " + query)

    var spaceEscapedQuery = query.replace(/\s/g, '\\ ')
    var spaceRemovedQuery = query.replace(/ /g, '')
    console.log("space escaped query")
    console.log(spaceEscapedQuery)

    var queries = [
        dbUtils.createFuzzyQuery("name", spaceEscapedQuery),
        dbUtils.createFuzzyQuery("location_name", spaceEscapedQuery),
        dbUtils.createFuzzyQuery("description", spaceEscapedQuery),
        dbUtils.createExistsQuery("value.sports." + spaceRemovedQuery)
    ]
    var finalQuery = dbUtils.queryJoinerOr(queries)

    var promises = [
        db.newSearchBuilder()
            .collection('facilities')
            .limit(10)
            .offset(0)
            .query(finalQuery)
    ]

    kew.all(promises)
        .then(function (results) {
            var response = {
                "data": dbUtils.injectId(results[0]),
            }
            res.send(response)
            res.status(200)
        })
        .fail(function (err) {
            customUtils.sendErrors(err, res)
        })
}])

module.exports = router