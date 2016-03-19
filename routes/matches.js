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
console.log("Event model")
console.log(EventModel)
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');
var MatchModel = require('../models/Match.js')

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
        //hasMale, hasFemale, hasCustomGender make it simpler to search for games that contain
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
                responseObj["errors"] = [err];
                res.status(422);
                res.json(responseObj);
            })

        //payload = MatchModel.updateGenderInPayload(payload, hostGender)
        //db.post('matches', payload)
        //    .then(function (result) {
        //        payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
        //        responseObj["data"] = payload;
        //        res.status(201);
        //        res.json(responseObj);
        //
        //        req.body.invitedUserIdList.forEach(function (invitedUserId) {
        //            RequestModel.createInviteToMatchRequest(user.id, user.name, payload["id"], payload["title"], payload["sport"], invitedUserId)
        //        })
        //
        //        if (payload.isFacility) {
        //            MatchModel.connectFacilityToMatch(payload["id"], payload["facilityId"])
        //        }
        //
        //        /**
        //         * The numerous graph relations are so that we
        //         * can access the related data from any entry point
        //         */
        //        var promises = []
        //            //The user hosts the match
        //        promises.push(dbUtils.createGraphRelationPromise('users', userId, 'matches', payload["id"], constants.graphRelations.users.hostsMatch))
        //        //The user plays in the match
        //        promises.push(dbUtils.createGraphRelationPromise('users', userId, 'matches', payload["id"], constants.graphRelations.users.playsMatches))
        //        //The match is hosted by user
        //        promises.push(dbUtils.createGraphRelationPromise('matches', payload["id"], 'users', userId, constants.graphRelations.matches.isHostedByUser))
        //        //The match has participants (user)
        //        promises.push(dbUtils.createGraphRelationPromise('matches', payload["id"], 'users', userId, constants.graphRelations.matches.participants))
        //        kew.all(promises)
        //        /**
        //         * Create the chat room for the match, and make the host join it
        //         */
        //        MatchModel.createChatRoomForMatch(user.qbId, payload["id"])
        //
        //        //var chatObj = {
        //        //    "created": date.getTime(),
        //        //    "type": "newChannel",
        //        //    "matchId": payload["id"],
        //        //    "pathTitle": reqBody.title
        //        //}
        //        EventModel.dispatchEvent(constants.events.matches.created, payload)
        //        //customUtils.notifyMatchCreated(payload["id"], payload["playing_time"])
        //    })
        //    .fail(function (err) {
        //        responseObj["errors"] = [err.body.message];
        //        res.status(422);
        //        res.json(responseObj);
        //    })
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

    if (errors.length > 0) {
        responseObj["errors"] = errors;
        res.status(422);
        res.json(responseObj);
    } else {
        db.merge('matches', matchId.req.body)
            .then(function (result) {
                payload["id"] = matchId;
                responseObj["data"] = req.body;
                res.status(201);
                res.json(responseObj);
            })
            .fail(function (err) {
                customUtils.sendErrors([err.body.message], 503, res)
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
            customUtils.sendErrors(["An Unexpected error has occurred. Check again"], 422, res)
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
            responseObj["errors"] = [err]
            res.status(422)
            res.json(responseObj)
        })

    //db.get('matches', matchId)
    //    .then(function (theMatch) {
    //        console.log(theMatch.body)
    //        var roomId = theMatch.body.qbId
    //        if (theMatch.body.slots == theMatch.body.slots_filled) {
    //            responseObj["errors"] = ["The Match is already full. Please contact the host"]
    //            res.status(422)
    //            res.json(responseObj)
    //            return
    //        } else {
    //            console.log("what")
    //            //Check if he has already joined the match
    //            MatchModel.checkMatchParticipationPromise(matchId, userId)
    //                .then(function (results) {
    //                    console.log("just checked match participation")
    //                    var count = results.body.count
    //                    if (count == 0) {
    //                        console.log("user determined to be not participating in match")
    //                        //qbchat.addUserToRoom(roomId, [userId], function (err, result) {
    //                        //    if (err) {
    //                        //        console.log(err)
    //                        //        customUtils.sendErrors(["Couldn't join you into the match's chat room"], 503, res)
    //                        //    } else {
    //                        dbUtils.createGraphRelationP('matches', matchId, 'users', userId, 'participants')
    //                        //customUtils.incrementMatchesPlayed(userId)
    //                        db.newGraphBuilder()
    //                            .create()
    //                            .from('users', userId)
    //                            .related('plays')
    //                            .to('matches', matchId)
    //                            .then(function (result) {
    //                                /**
    //                                 * You are hoping that orchestrate handles concurrency
    //                                 * this sort of modification needs to be safe from race conditions
    //                                 */
    //                                console.log(theMatch.body.slots_filled)
    //                                var slots = theMatch.body.slots
    //                                var slotsFilled = theMatch.body.slots_filled + 1
    //                                var payload = {
    //                                    'slots_filled': slotsFilled
    //                                }
    //
    //                                //if match is full make it undiscoverable
    //                                if (slots == slotsFilled) {
    //                                    payload["isDiscoverable"] = false
    //                                }
    //                                payload = MatchModel.updateGenderInPayload(payload, usersGender)
    //                                db.merge('matches', matchId, payload)
    //                                MatchModel.updateMatchConnections(userId, matchId)
    //
    //
    //                                responseObj["data"] = []
    //                                responseObj["message"] = "Successfully joined"
    //                                res.status(200)
    //                                res.json(responseObj)
    //                            })
    //                            .fail(function (err) {
    //                                responseObj["errors"] = [err.body.message, "Could not join you into the match, Please try again later"]
    //                                res.status(503)
    //                                res.json(responseObj)
    //                            })
    //                        //}
    //                        //})
    //                    } else {
    //                        customUtils.sendErrors(["You are already part of this match"], 422, res)
    //                    }
    //                })
    //        }
    //    })
    //    .fail(function (err) {
    //        responseObj["errors"] = [err.body.message]
    //        res.status(503)
    //        res.json(responseObj)
    //    })
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
    var page = req.query.page || 1
    var limit = req.query.limit || 100

    console.log("default time and isDiscoverable query")
    queries.push(MatchModel.createIsDiscoverableQuery())

    var isDistanceQuery = false
    var isMatchQuery = false
    var getFeatured = false

    //if (req.query.limit && req.query.page) {
    //    page = req.query.page
    //    limit = req.query.limit
    //}
    var offset = limit * (page - 1)

    if (req.query.matchId) {
        isMatchQuery = true
        console.log("we have a specific matchId query")
        queries.push(dbUtils.createSearchByIdQuery(req.query.matchId))
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
            .query(theFinalQuery)
        promises.push(distanceLessQuery)
    }

    if (isMatchQuery) {
        promises.push(MatchModel.checkMatchParticipationPromise(req.query.matchId, userId))
    } else {
        //pass a resolved dummy promise so the order of the array is always constant
        promises.push(kew.resolve([]))
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

    kew.all(promises)
        .then(function (results) {
            //result[0] is the main quelocalhost:3002/matches?access_token=461b9f4c1abe77abb26bb965234ab40f&lat=28.5330441&long=77.2111807&radius=20037.5kmry
            //result[1] is the match participation query (if isMatchQuery is true)
            //result[2] is the featured matches query
            //result[3] is the match participants
            if (distanceQuery) {
                results[0] = MatchModel.insertDistance(results[0], req.query.lat, req.query.long)
            }
            responseObj["total_count"] = results[0].body.total_count
            responseObj["data"] = dbUtils.injectId(results[0])
            //isJoined tells if the current user is part of the match or not
            if (isMatchQuery) {
                var count = results[1].body.count
                if (count == 0) {
                    responseObj["isJoined"] = false
                } else {
                    responseObj["isJoined"] = true
                }
                var matchParticipants = dbUtils.injectId(results[3])
                responseObj["players"] = matchParticipants
            }
            if (getFeatured) {
                var featuredEvents = dbUtils.injectId(results[2])
                responseObj["featuredEvents"] = featuredEvents
            }
            res.status(200)
            res.json(responseObj)
        })
        .fail(function (err) {
            customUtils.sendErrors([err.body.message], 503, res)
        })
}])

module.exports = router;