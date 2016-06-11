var express = require('express');
var router = express.Router();

var passport = require('passport');

//var config = require('../models/Match.js');
var matchValidation = require('../validations/Match.js');
var kew = require('kew')

//kardo sab import, node only uses it once
var config = require('../config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require('../utils.js');
var constants = require('../constants');
var qbchat = require('../Chat/qbchat');
var UserModel = require('../models/User');

var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');
var MatchModel = require('../models/Match.js')
var date = new Date()

//var Notifications = require('../notifications');
//var notify = new Notifications();

//var expressValidator = require('express-validator')
//var customValidations = require('../customValidations')
//passport.authenticate('bearer', {session: false}),

//TODO: remove sensitive information about host from the json inside the match's host key
router.post('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var responseObj = {}
    var user = req.user.results[0].value
    var userId = req.user.results[0].value.id
    var hostGender = req.user.results[0].value.gender

    //req.checkBody(matchValidation.postMatch)
    var validationResponse = matchValidation.validatePostMatch(req.body);

    req.body = validationResponse.reqBody
    var errors = validationResponse.errors

    if (errors.length > 0) {
        responseObj["errors"] = errors;
        res.status(422);
        res.json(responseObj);
    } else {
        //Note only insert in a denormalized manner the host details of what is required
        //hasMale, hasFemale, hasCustomGender makes it simpler to search for games that contain
        //males, females or custom gender participants
        var payload = {
            title: req.body.title,
            description: req.body.description,
            sport: req.body.sport,
            skill_level_min: req.body.skill_level_min,
            skill_level_max: req.body.skill_level_max,
            playing_time: req.body.playing_time,
            slots_filled: 1, //the host is a participant of the match
            slots: req.body.slots,
            location_name: req.body.location_name,
            location: {
                lat: req.body.lat,
                long: req.body.long
            },
            host: {
                id: user.id,
                name: user.name,
                username: user.username,
                avatar: user.avatar,
                avatarThumb: user.avatarThumb
            },
            isFacility: req.body.isFacility,
            isAdminMarked: false, //admins marking this as done -- if its a facility match
            facilityId: req.body.facilityId,
            type: "match",
            hasMale: false,
            hasFemale: false,
            hasCustomGender: false,
            isDiscoverable: true
        }

        MatchModel.createMatch(payload, user, req.body.invitedUserIds)
            .then(function (results) {
                responseObj["data"] = payload;
                res.status(201);
                res.json(responseObj);
            })
            .fail(function (err) {
                customUtils.sendErrors(err, res)
            })
    }
}])

router.patch('/', [passport.authenticate('bearer', {session: false}), function (req, res, next) {
    var responseObj = {}
    var user = req.user.results[0].value
    var matchId = req.body.matchId
    //var invitedUsersIds = req.body.invitedUserIds

    var validationResponse = matchValidation.validatePatchMatch(req.body);
    req.body = validationResponse.reqBody
    var errors = validationResponse.errors
    var payload = {}

    if (errors.length > 0) {
        responseObj["errors"] = errors;
        res.status(422);
        res.json(responseObj);
    } else {
        var sanitizedPayload = {
            title: req.body.title,
            description: req.body.description,
            playing_time: req.body.playing_time,
            location_name: req.body.location_name,
            location: {
                lat: req.body.lat,
                long: req.body.long
            },
            isAdminMarked: req.body.isAdminMarked,
            isFacility: req.body.isFacility,
            facilityId: req.body.facilityId,
            note: req.body.note //TODO : limit the length so this field cannot be exploited
        }

        console.log(sanitizedPayload)

        db.merge('matches', req.query.matchId, sanitizedPayload)
            .then(function (result) {
                return db.get('matches', req.query.matchId)
            })
            .then(function (theMatch) {
                //payload["id"] = matchId;
                responseObj["data"] = theMatch.body;
                res.status(201);
                res.json(responseObj);
            })
            .fail(function (err) {
                customUtils.sendErrors(err, res)
            })
    }
}])


router.post('/remove', [passport.authenticate('bearer', {session: false}), function (req, res, next) {
    var responseObj = {}
    var matchId = req.body.matchId
    var userId = req.body.userId

    //TODO: if a user of the only representing gender is removed
    //update the genderStatus of the match

    MatchModel.removeFromMatch(userId, matchId)
        .then(function (result) {
            responseObj["data"] = [];
            res.status(201);
            res.json(responseObj);
        })
        .fail(function (error) {
            customUtils.sendErrors(error, res)
        })
}])

router.post('/join', [passport.authenticate('bearer', {session: false}), function (req, res) {
    console.log("definitely here")
    var matchId = req.body.matchId;
    var userId = req.user.results[0].value.id;
    var responseObj = {}

    MatchModel.joinMatch(matchId, userId)
        .then(function (result) {
            responseObj["data"] = []
            responseObj["message"] = "Successfully joined"
            res.status(200)
            res.json(responseObj)
        })
        .fail(function (err) {
            customUtils.sendErrors(err, res)
            // console.log("what")
            // console.log(err.message)
            // responseObj["errors"] = err
            // res.status(422)
            // res.json(responseObj)
        })

}])

router.post('/join/request', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var matchId = req.body.matchId;
    var userId = req.user.results[0].value.id;
    var usersFullName = req.user.results[0].value.name;
    var usersPhoto = req.user.results[0].value.avatarThumb
    var responseObj = {}

    console.log("whats going on")

    MatchModel.getMatchPromise(matchId)
        .then(function (results) {
            var theMatch = results.body
            console.log("got the match")
            theMatch["id"] = matchId
            console.log(theMatch)
            RequestModel.createRequestToJoinMatch(theMatch.host.id, userId, theMatch, usersFullName, usersPhoto)
            responseObj["data"] = {}
            res.status(200)
            res.json(responseObj)
        })
        .fail(function (err) {
            customUtils.sendErrors(err, res)
        })
}])

router.post('/invite', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var matchId = req.body.matchId
    var hostUserId = req.user.results[0].value.id
    var invitedUserId = req.body.invitedUserIds.split(",")
    var responseObj = {}

    db.get('matches', matchId)
        .then(function (result) {
            if (result.body.host.id != hostUserId) {
                responseObj["errors"] = ["Only the host of the match can invite people"]
                res.status(403)
                res.json(responseObj)
            } else {
                return kew.all([
                    dbUtils.createGraphRelationPromise('matches', matchId, 'users', invitedUserId, constants.graphRelations.matches.invitedUsers),
                    dbUtils.createGraphRelationPromise('users', invitedUserId, 'matches', matchId, constants.graphRelations.users.invitedToMatch)
                ])
                //customUtils.createRequest('invitedToMatch', invitedUserId, matchId, hostUserId)
            }
        })
        .then(function (result) {
            responseObj["data"] = []
            responseObj["message"] = ["Users have been invited. Duplicate invites are not sent out."]
            res.status(200)
            res.json(responseObj)
        })
        .fail(function (err) {
            responseObj["errors"] = [err.body.message]
            res.status(503)
            res.json(responseObj)
        })
}])


router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var promises = []
    var userId = req.user.results[0].value.id
    var queries = []
    var responseObj = {}
    var limit = req.query.limit || 100
    var page = req.query.page || 1
    var offset = limit * (page - 1)

    if (req.query.matchId) {
        isMatchQuery = true
        console.log("we have a specific matchId query")
        //all other queries must be destroyed and only this should prevail
        queries = [dbUtils.createSearchByIdQuery(req.query.matchId)]
    } else {
        console.log("default time and isDiscoverable query")
        if (req.query.showAll)
            queries.push("@path.kind:item")
        else
            queries.push(MatchModel.createIsDiscoverableQuery())

        var isDistanceQuery = false
        var isMatchQuery = false
        var getFeatured = false

        if (req.query.isFacility) {
            console.log("only facility matches")
            queries.push("value.isFacility:true")
        }

        if (req.query.gender) {
            console.log("we have a gender query")
            var genderArray = req.query.gender.split(',')
            queries.push(MatchModel.createGenderQuery(genderArray))
        }

        if (req.query.lat && req.query.long && req.query.radius) {
            console.log("we have a distance query")
            queries.push(dbUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius))
            isDistanceQuery = true;
        }

        if (req.query.sports) {
            console.log("we have a sports filter")
            var sportsArray = req.query.sports.split(',');
            queries.push(MatchModel.createSportsQuery(sportsArray))
        }

        if (req.query.skill_level_min && req.query.skill_level_max) {
            console.log("we have a skill level filter")
            queries.push(MatchModel.createSkillRatingQuery(req.query.skill_level_min, req.query.skill_level_max))
        }
    }

    var theFinalQuery = dbUtils.queryJoiner(queries)
    console.log("The final query")
    console.log(theFinalQuery)

    if (isDistanceQuery) {
        var distanceQuery = db.newSearchBuilder()
            .collection("matches")
            .limit(limit)
            .offset(offset)
            .sort('location', 'distance:asc')
            .query(theFinalQuery)
        promises.push(distanceQuery)
    } else {
        /**
         * remove sort by location if query does not have
         * location. the orchestrate query won't work otherwise
         */
        var distanceLessQuery = db.newSearchBuilder()
            .collection("matches")
            .limit(limit)
            .offset(offset)
            //.sort('location', 'distance:asc')
            .sortBy('@path.reftime:desc')
            .query(theFinalQuery)
        promises.push(distanceLessQuery)
    }

    //if (req.query.featured) {
    //console.log(EventModel.constants)
    getFeatured = true;
    promises.push(EventModel.getFeaturedEventsPromise())
    //} else {
    //pass a resolved dummy promise so the order of the array is always constant
    //promises.push(kew.resolve([]))
    //}

    //push match participants
    if (isMatchQuery) {
        promises.push(MatchModel.getMatchParticipantsPromise(req.query.matchId))
    } else {
        promises.push(kew.resolve([]))
    }

    if (req.query.showAll) promises.push(MatchModel.getAdminMarkedCount())

    var theMasterResults
    kew.all(promises)
        .then(function (results) {
            //result[0] is the main query
            //result[1] is the featured events query
            //result[2] is the match participants
            //result[3] is the adminMarked/total_matches count
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
            console.log("isMatchQuery : " + isMatchQuery)
            if (isMatchQuery) {
                var matchParticipants = dbUtils.injectId(theMasterResults[2])
                responseObj["players"] = matchParticipants
            }
            if (getFeatured) {
                var featuredEvents = dbUtils.injectId(theMasterResults[1])
                responseObj["featuredEvents"] = featuredEvents
            }
            if (req.query.showAll) {
                console.log(theMasterResults[3])
                responseObj["adminMarked"] = theMasterResults[3].body.total_count
            }
            res.status(200)
            res.json(responseObj)
        })
        .fail(function (err) {
            customUtils.sendErrors(err, res)
        })
}])

router.get('/test', function (req, res) {
    res.status(200)

    var user1id = "47a7897ce58217ad"
    var user2id = "19d662fd0287a6c2"
    var matchPayload = {
        description: 'bjkk',
        hasCustomGender: false,
        hasFemale: false,
        hasMale: false,
        host: {
            avatar: 'https://graph.facebook.com/10153182210946213/picture?type=large',
            avatarThumb: 'https://graph.facebook.com/10153182210946213/picture',
            id: '47a7897ce58217ad',
            name: 'Ankan Adhikari',
            username: 'ankan_b387',
            qbId: 13654128
        },
        isAdminMarked: false,
        isDiscoverable: true,
        isFacility: false,
        location: {lat: 28.5331782, long: 77.2120782},
        location_name: '7, Toot Sarai Rd,New Delhi,Delhi',
        playing_time: 1465991040,
        skill_level_max: 5,
        skill_level_min: 1,
        slots: 2,
        slots_filled: 1,
        sport: 'cricket',
        title: 'hggh',
        type: 'match'
    }
    RequestModel.acceptMatchRequest(user1id, user2id, matchPayload)
        .then(function (results) {
            res.status(200)
            res.json({data: "ok"})
        })
        .fail(function (err) {
            console.log(err)
        })
})

module.exports = router;