//kardo sab import, node only uses it once
var config = require('../config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require('../utils.js');
var constants = require('../constants');
var qbchat = require('../Chat/qbchat');
var UserModel = require('../models/User');
//var MatchModel = require('../models/Match');
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');
var ChatModel = require('../Chat/Chat');
var date = new Date()

/**
 * LUCENE query generators ------------------------------------->
 */
/**
 * generete the lucene query for min and max skill rating
 *
 * Lucene reference:
 * Your queries can contain as many as ten different buckets in a single Range Aggregate.
 * Each bucket can have numerical min and max values, separated by a tilde character (~).
 * An asterisk may be used to designate a particular range bucket as boundless.
 * For example, the range *~-10 would mean "all values less than negative ten" and
 * the range 100~* would communicate "all values greater than or equal to one hundred".
 *
 * Ya that shit didn't work so I used the range [minRating TO 5] etc. -_- :*
 * @param minRating
 * @param maxRating
 */
function createSkillRatingQuery(minRating, maxRating) {
    var skillQuery = "value.skill_level_min:[" + minRating + " TO 5] AND " + "value.skill_level_max:[1 TO " + maxRating + "]"
    return skillQuery
}

function connectFacilityToMatch(matchId, facilityId) {
    return kew.all([
        dbUtils.createGraphRelationPromise('matches', matchId, 'facilities', facilityId, constants.graphRelations.matches.hostedFacility),
        dbUtils.createGraphRelationPromise('facilities', facilityId, 'matches', matchId, constants.graphRelations.matches.hasMatches)
    ])
}

/**
 * get results having playing_time that are past the current time
 * and whose results matches/events are discoverable
 * @returns {string}
 */
function createIsDiscoverableQuery() {
    var currentUnixTime = Math.round(date.getTime() / 1000)
    var query = "value.playing_time: " + currentUnixTime + "~*"  //this means greater than equalto
    //https://orchestrate.io/docs/apiref#search
    //matches that are not discoverable for any reason are set to isDiscoverable: false
    query = query + " AND value.isDiscoverable:true"
    return query
}

/**
 * Note : For lucene you can use filed grouping:
 * Field Grouping
 * Lucene supports using parentheses to group multiple clauses to a single field.
 * To search for a title that contains both the word "return" and the phrase "pink panther" use the query:
 * title:(+return +"pink panther")
 *
 * createSportsQuery can be updated this way
 */

/**
 * Crate a lucene OR query with the array of sports provided
 * @param sportsArray
 * @returns {string}
 */
function createSportsQuery(sportsArray) {
    return dbUtils.createFieldORQuery(sportsArray, "value.sports")
}

/**
 * Crate a lucene OR query with the array of gender provided
 * @param genderArray
 * @returns {*}
 */
function createGenderQuery(genderArray) {
    return dbUtils.createFieldORQuery(genderArray, "value.gender")
}

/**
 * assuming the field type is time
 */
function createOnlyFutureTypeQuery() {
    var currentUnixTime = Math.round(date.getTime() / 1000);
    //this means greater than equalto
    return "value.time: " + currentUnixTime + "~*"
}

/**
 * check if a user is participating in a match
 * @param matchId
 * @param userId
 * @returns {SearchBuilder}
 */
function checkMatchParticipationPromise(matchId, userId) {
    //TODO : red alert, why does this require have to be here!
    //var dbUtils = require('../dbUtils');
    var checkMatchParticipation =
        db.newSearchBuilder()
            .query(dbUtils.createGetOneOnOneGraphRelationQuery('matches', matchId, constants.graphRelations.matches.participants, 'users', userId))
    return checkMatchParticipation
}

function incrementMatchesPlayed(userId) {
    return db.get("users", userId)
        .then(function (result) {
            var matchesPlayed = result.body.matchesPlayed;
            db.merge("users", userId, {
                matchesPlayed: matchesPlayed + 1
            })
        })
}

function decrementMatchesPlayed(userId) {
    return db.get("users", userId)
        .then(function (result) {
            var matchesPlayed = result.body.matchesPlayed;
            return db.merge("users", userId, {
                matchesPlayed: matchesPlayed - 1
            })
        })
}

/**
 * inject the distance between the match and the user in km
 * @param results orchestrate response of matches
 * @param usersLat lat coordinates of the user
 * @param usersLong long coordinates of the user
 */
var insertDistance = function (results, usersLat, usersLong) {
    var newResults = results.body.results.map(function (aResult) {
        aResult["value"]["distance"] = customUtils.getDistanceFromLatLonInKm(
            aResult["value"]["location"]["lat"],
            aResult["value"]["location"]["long"],
            usersLat,
            usersLong
        )
        return aResult;
    })
    results.body.results = newResults
    return results
}

/**
 * update the connections of all users when a new player
 * joins the match
 * @param userId
 * @param matchId
 */
function updateMatchConnections(userId, matchId) {
    /**
     * get all the players of the match
     * let playerList = the players of the match except the player in userId
     * create connections of userId to the playerList if no existing connection exists
     * create connections of each player in playerList to the userId if no existing connection exists
     */
    dbUtils.getGraphResultsPromise('matches', matchId, constants.graphRelations.matches.participants)
        .then(function (results) {
            //get all the players of the match
            var playerList = results.body.results.map(function (oneUser) {
                return oneUser.path.key;
            })

            //let players = the players of the match except the player in userId
            var index = playerList.indexOf(userId)
            if (index > -1) {
                playerList.splice(index, 1);
            }

            playerList.forEach(function (playerId) {
                kew.all([
                    dbUtils.createGraphRelationPromise('users', userId, 'users', playerId, constants.graphRelations.users.connections),
                    dbUtils.createGraphRelationPromise('users', playerId, 'users', userId, constants.graphRelations.users.connections)
                ])
            })
        })
    //no status really returned here
}


/**
 * create the chat room for a match
 * @param hostUserQbId
 * @param matchId
 */
function createChatRoomForMatch(hostUserQbId, matchId) {
    /**
     * format of match dialog title:
     * <matchRoom>:::matchId
     * format of user dialog title:
     * <connectionRoom>:::user1id:::user2Id
     */
    var chatRoomCreated = kew.defer()
    var chatRoomName = constants.chats.matchRoom + ":::" + matchId
    var newRoomId
    ChatModel.createGroupChatRoom(chatRoomName)
        .then(function (newRoom) {
            newRoomId = newRoom._id
            return ChatModel.addUsersToRoom(newRoomId, [hostUserQbId])
        })
        .then(function (roomJoinStatus) {
            return db.merge('matches', matchId, {"qbId": newRoomId})
        })
        .then(function (mergeSuccess) {
            chatRoomCreated.resolve(mergeSuccess)
        })
        .fail(function (err) {
            chatRoomCreated.reject(err)
        })

    return chatRoomCreated
}

/**
 * takes a json payload and inserts flags:
 * hasMale, hasFemale, hasCustomGender
 * @param payload
 * @param gender
 * @returns {*}
 */
function updateGenderInPayload(payload, gender) {
    if (gender == "male")
        payload["hasMale"] = true
    else if (gender == "female")
        payload["hasFemale"] = true
    else {
        payload["hasCustomGender"] = true
    }
    return payload
}

function getFacilityOfMatchPromise(matchId) {
    return dbUtils.getGraphResultsPromise('matches', matchId, constants.graphRelations.matches.hostedFacility)
}

function getMatchPromise(matchId) {
    return db.get('matches', matchId)
}

function getFacilityPromise(facilityId) {
    return db.get('facilities', facilityId)
}

/**
 * get the promise that gets the participants of the matches
 * @param matchId
 */
function getMatchParticipantsPromise(matchId) {
    return dbUtils.getGraphResultsPromise('matches', matchId, constants.graphRelations.matches.participants)
}

function getMatchHistoryPromise(userId) {
    return dbUtils.getGraphResultsPromise('users', userId, constants.graphRelations.users.playsMatches)
}

function removeFromMatch(userId, matchId) {
    //decrease slots_filled of the given match
    //remove from chat channel
    return kew.all([
        dbUtils.deleteGraphRelationPromise('matches', matchId, 'users', userId, constants.graphRelations.matches.participants),
        dbUtils.deleteGraphRelationPromise('users', userId, 'matches', matchId, constants.graphRelations.users.playsMatches),
        decrementMatchesPlayed(userId)
    ])
}

/**
 * that massive createMatch method
 * match payload expectations:
 * keep this updated if you want a good life.
 * var payload = {
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

 * hostData = {
 *      id, name, qbId,
 * }
 *
 * creates a match, creates its cha
 * @param payload
 * @param hostData
 */
function createMatch(payload, hostData, invitedUserIdList) {
    var matchCreated = kew.defer()
    payload = updateGenderInPayload(payload, hostData.gender)
    db.post('matches', payload)
        .then(function (result) {
            payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
            matchCreated.resolve(payload)

            var promises = []

            invitedUserIdList.forEach(function (invitedUserId) {
                RequestModel.createInviteToMatchRequest(hostData.id, hostData.name, payload, invitedUserId)
            })

            if (payload.isFacility) {
                promises.push(connectFacilityToMatch(payload["id"], payload["facilityId"]))
            }

            /**
             * The numerous graph relations are so that we
             * can access the related data from any entry point
             */

            //The user hosts the match
            promises.push(dbUtils.createGraphRelationPromise('users', hostData.id, 'matches', payload["id"], constants.graphRelations.users.hostsMatch))
            //The user plays in the match
            promises.push(dbUtils.createGraphRelationPromise('users', hostData.id, 'matches', payload["id"], constants.graphRelations.users.playsMatches))
            //The match is hosted by user
            promises.push(dbUtils.createGraphRelationPromise('matches', payload["id"], 'users', hostData.id, constants.graphRelations.matches.isHostedByUser))
            //The match has participants (user)
            promises.push(dbUtils.createGraphRelationPromise('matches', payload["id"], 'users', hostData.id, constants.graphRelations.matches.participants))

            /**
             * Create the chat room for the match, and make the host join it
             */
            promises.push(createChatRoomForMatch(hostData.qbId, payload["id"]))

            kew.all(promises)
                .then(function(results) {
                    console.log("match creation fully complete")
                    matchCreated.resolve()
                })
                .fail(function(err) {
                    console.log("match creation failed")
                    matchCreated.reject(err)
                    console.log(err)
                })
            //var chatObj = {
            //    "created": date.getTime(),
            //    "type": "newChannel",
            //    "matchId": payload["id"],
            //    "pathTitle": reqBody.title
            //}
            EventSystem.dispatchEvent(constants.events.matches.created, payload)
        })
        .fail(function(err) {
            matchCreated.reject(err)
        })
    return matchCreated
}

function joinMatch(matchId, joineeId) {
    var joineeGender
    var joineeQBid

    function incrementFilledSlots(slots, slotsFilled) {
        slots
        slotsFilled++
        var payload = {
            'slots_filled': slotsFilled
        }

        //if match is full make it undiscoverable
        if (slots == slotsFilled) {
            payload["isDiscoverable"] = false
        }
        payload = updateGenderInPayload(payload, joineeGender)
        db.merge('matches', matchId, payload)
        updateMatchConnections(joineeId, matchId)
    }

    var joinStatus = kew.defer()
    /**
     * how do you share data between promise chains?
     * http://stackoverflow.com/questions/28250680/how-do-i-access-previous-promise-results-in-a-then-chain
     */
    var matchDetails

    kew.all([getMatchPromise(matchId), UserModel.getUserPromise(joineeId)])
        .then(function(results) {
            matchDetails = results[0]
            joineeGender = results[1].gender
            joineeQBid = results[1].qbId
            if (matchDetails.slots == matchDetails.slots_filled)
                return kew.reject(new Error("The Match is already full. Please contact the host"))
            else
                return checkMatchParticipationPromise(matchId, joineeId)
        })
        .then(function(results) {
            var count = results.body.count
            if (count == 0) {
                return kew.all([
                    dbUtils.createGraphRelationPromise('matches', matchId, 'users', joineeId, constants.graphRelations.matches.participants),
                    dbUtils.createGraphRelationPromise('users', joineeId, 'matches', matchId, constants.graphRelations.users.playsMatches)
                ])
            } else {
                return kew.reject(new Error("You are already part of this match"))
            }
        })
        .then(function(results) {
            incrementFilledSlots()
            return ChatModel.addUsersToRoom(matchDetails.qbId, [joineeQBid])
        })
        .then(function(joinedMatchChat) {
            return joinStatus.resolve()
        })
        .fail(function(err) {
            joinStatus.reject(err)
        })
    return joinStatus
}


module.exports = {
    getMatchParticipantsPromise: getMatchParticipantsPromise,
    createSportsQuery: createSportsQuery,
    getMatchHistoryPromise: getMatchHistoryPromise,
    createOnlyFutureTypeQuery: createOnlyFutureTypeQuery,
    connectFacilityToMatch: connectFacilityToMatch,
    checkMatchParticipationPromise: checkMatchParticipationPromise,
    updateGenderInPayload: updateGenderInPayload,
    updateMatchConnections: updateMatchConnections,
    createIsDiscoverableQuery: createIsDiscoverableQuery,
    createGenderQuery: createGenderQuery,
    createChatRoomForMatch: createChatRoomForMatch,
    removeFromMatch: removeFromMatch,
    createSkillRatingQuery: createSkillRatingQuery,
    insertDistance: insertDistance,
    createMatch : createMatch,
    joinMatch : joinMatch,
    getMatchPromise : getMatchPromise
}