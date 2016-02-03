var express = require('express');
var router = express.Router();

var passport = require('passport');
customUtils = require('../utils.js');

var config = require('../config.js');
//var config = require('../models/Match.js');
var matchValidation = require('../validations/Match.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var qbchat = require('../qbchat.js');
var kew = require('kew')

var Notifications = require('../notifications');
//var notify = new Notifications();

//var expressValidator = require('express-validator')
//var customValidations = require('../customValidations')
//passport.authenticate('bearer', {session: false}),

//TODO: remove sensitive information about host from the json inside the match's host key
router.post('/', [passport.authenticate('bearer', {session: false}), function (req, res, next) {
    qbchat.getSession(function (err, session) {
        if (err) {
            console.log("Recreating session");
            qbchat.createSession(function (err, result) {
                if (err) {
                    customUtils.sendErrors(["Can't connect to the chat server, try again later"], 503, res)
                } else next();
            })
        } else next();
    })
}, function (req, res) {
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
            type: "match",
            hasMale: false,
            hasFemale: false,
            hasCustomGender: false,
            isDiscoverable: true,
            isFeatured: false
        }

        payload = customUtils.updateGenderInPayload(payload, hostGender)

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

                /**
                 * Create the chat room for the match, and make the host join it
                 */
                //var chatObj = {
                //    "created": date.getTime(),
                //    "type": "newChannel",
                //    "matchId": payload["id"],
                //    "pathTitle": reqBody.title
                //}

                /**
                 * The title is appended with <matchRoom>
                 * to differentiate it from <connectionRoom>
                 */
                qbchat.createRoom(2, payload["title"] + " : <matchRoom>", function (err, newRoom) {
                    if (err) console.log(err);
                    else {
                        qbchat.addUserToRoom(newRoom._id, [user.qbId], function (err, result) {
                            if (err) console.log(err);
                        })
                        db.merge('matches', payload["id"], {"qbId": newRoom._id})
                            .then(function (result) {
                                //chatObj["id"] = date.getTime() + "@1";
                                //chatObj["channelName"] = payload["title"];
                                //chatObj["channelId"] = newRoom._id;
                                //notify.emit('wordForChat', chatObj);
                            })
                            .fail(function (err) {
                                console.log(err.body.message);
                            });
                    }
                });
                customUtils.notifyMatchCreated(payload["id"], payload["playing_time"])
            })
            .fail(function (err) {
                responseObj["errors"] = [err.body.message];
                res.status(422);
                res.json(responseObj);
            })
        //TODO: isFacility is true, set up graph relation and access codes
    }
}])

router.post('/join', [passport.authenticate('bearer', {session: false}), function (req, res, next) {
    qbchat.getSession(function (err, session) {
        if (err) {
            console.log("Recreating session");
            qbchat.createSession(function (err, result) {
                if (err) {
                    console.log(err)
                    customUtils.sendErrors(["Can't connect to the chat server, try again later"], 503, res)
                } else next();
            })
        } else next();
    })
}, function (req, res) {
    console.log("definitely here")
    var matchId = req.body.matchId;
    var userId = req.user.results[0].value.id;
    var responseObj = {}

    db.get('matches', matchId)
        .then(function (result) {
            var roomId = result.body.qbId
            if (result.body.slots == result.body.slots_filled) {
                responseObj["errors"] = ["The Match is already full. Please contact the host"]
                res.status(422)
                res.json(responseObj)
                return
            }
            else {
                //Check if he has already joined the match
                customUtils.checkMatchParticipationPromise(matchId, userId)
                    .then(function (results) {
                        console.log("just checked match participation")
                        var count = results.body.count
                        if (count == 0) {
                            console.log("user determined to be not participating in match")
                            qbchat.addUserToRoom(roomId, [userId], function (err, result) {
                                if (err) {
                                    console.log(err)
                                    customUtils.sendErrors(["Couldn't join you into the match's chat room"], 503, res)
                                } else {
                                    customUtils.createGraphRelation('matches', matchId, 'users', userId, 'participants')
                                    customUtils.incrementMatchesPlayed(userId)
                                    db.newGraphBuilder()
                                        .create()
                                        .from('users', userId)
                                        .related('plays')
                                        .to('matches', matchId)
                                        .then(function (result) {
                                            /**
                                             * You are hoping that orchestrate handles concurrency
                                             * this sort of modification needs to be safe from race conditions
                                             */
                                            var slots = result.value.slots
                                            var slotsFilled = result.value.slots_filled + 1
                                            var payload = {
                                                'slots_filled': slotsFilled
                                            }

                                            //if match is full make it undiscoverable
                                            if (slots == slotsFilled) {
                                                payload["isDiscoverable"] = false
                                            }

                                            db.merge('matches', payload)
                                            customUtils.updateMatchConnections(userId, matchId)

                                            responseObj["data"] = result
                                            res.status(200)
                                            res.json(responseObj)
                                        })
                                        .fail(function (err) {
                                            responseObj["errors"] = [err.body.message, "Could not join you into the match, Please try again later"]
                                            res.status(503)
                                            res.json(responseObj)
                                        })
                                }
                            })
                        } else {
                            customUtils.sendErrors(["You are already part of this match"], 422, res)
                        }
                    })
            }
        })
        .fail(function (err) {
            responseObj["errors"] = [err.body.message]
            res.status(503)
            res.json(responseObj)
        })
}])

router.post('/invite', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var matchId = req.body.matchId
    var hostUserId = req.user.results[0].value.id
    var invitedUserId = req.body.invitedUserId
    var responseObj = {}

    db.get('matches', matchId)
        .then(function (result) {
            if (result.body.host.id != hostUserId) {
                responseObj["errors"] = ["Only the host of the match can invite people"]
                res.status(403)
                res.json(responseObj)
            } else {
                customUtils.createGraphRelation('matches', matchId, 'users', invitedUserId, 'invitees')
                customUtils.createGraphRelation('users', invitedUserId, 'matches', matchId, 'invited')
                customUtils.createRequest('invitedToMatch', invitedUserId, matchId, hostUserId)
                responseObj["data"] = []
                responseObj["message"] = ["Users have been invited. Duplicate invites are not sent out."]
                res.status(200)
                res.json(responseObj)
            }
        })
        .fail(function (err) {
            responseObj["errors"] = [err.body.message]
            res.status(503)
            res.json(responseObj)
        })
}])


router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var promises = new Array()
    var userId = req.user.results[0].value.id
    var queries = new Array()
    var responseObj = {}
    var page = 1
    var limit = 100

    console.log("omg the id is " + userId)
    console.log("default time and isDiscoverable query")
    queries.push(customUtils.createIsDiscoverableQuery())

    var isDistanceQuery = false
    var isMatchQuery = false
    var getFeatured = false

    if (req.query.limit && req.query.page) {
        page = req.query.page
        limit = req.query.limit
    }
    var offset = limit * (page - 1)

    if (req.query.matchId) {
        isMatchQuery = true
        console.log("we have a specific matchId query")
        queries.push(customUtils.createSearchByIdQuery(req.query.matchId))
    }

    if (req.query.gender) {
        console.log("we have a gender query")
        var genderArray = req.query.gender.split(',')
        queries.push(customUtils.createGenderQuery(genderArray))
    }

    if (req.query.lat && req.query.long && req.query.radius) {
        console.log("we have a distance query")
        queries.push(customUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius))
        isDistanceQuery = true;
    }

    if (req.query.sports) {
        console.log("we have a sports filter")
        var sportsArray = req.query.sports.split(',');
        queries.push(customUtils.createSportsQuery(sportsArray))
    }

    if (req.query.skill_level_min && req.query.skill_level_max) {
        console.log("we have a skill level filter")
        queries.push(customUtils.createSkillRatingQuery(req.query.skill_level_min, req.query.skill_level_max))
    }

    var theFinalQuery = customUtils.queryJoiner(queries)
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
        promises.push(customUtils.checkMatchParticipationPromise(req.query.matchId, userId))
    } else {
        //pass a resolved dummy promise so the order of the array is always constant
        promises.push(kew.resolve([]))
    }

    if (req.query.featured) {
        getFeatured = true;
        promises.push(customUtils.getFeaturedMatchesPromise())
    } else {
        //pass a resolved dummy promise so the order of the array is always constant
        promises.push(kew.resolve([]))
    }

    kew.all(promises)
        .then(function (results) {
            //result[0] is the main query
            //result[1] is the match participation query (if isMatchQuery is true)
            //result[2] is the featured matches query
            if (distanceQuery) {
                results[0] = customUtils.insertDistance(results[0], req.query.lat, req.query.long)
            }
            responseObj["total_count"] = results[0].body.total_count
            responseObj["data"] = customUtils.injectId(results[0])

            //isJoined tells if the current user is part of the match or not
            if (isMatchQuery) {
                console.log("the results are ")
                console.log(results[1].body.results[0].path)
                var count = results[1].body.count
                console.log("count is " + count)
                if (count == 0) {
                    responseObj["isJoined"] = false
                } else {
                    responseObj["isJoined"] = true
                }
            }
            if (getFeatured) {
                var featuredMatches = customUtils.injectId(results[2])
                responseObj["featured"] = featuredMatches
            }
            res.status(200)
            res.json(responseObj)
        })
        .fail(function (err) {
            customUtils.sendErrors([err.body.message], 503, res)
        })
}])

router.get('/test', function (req, res) {
    console.log(req.query)
})

module.exports = router;