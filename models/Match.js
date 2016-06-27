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
var kew = require('kew');
var EventSystem = require('../events/events');
var dispatchers = require('../notifications/dispatchers');
var ChatModel = require('../Chat/Chat');
// var date = new Date()

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
        dbUtils.createGraphRelationPromise('facilities', facilityId, 'matches', matchId, constants.graphRelations.facilities.hasMatches)
    ])
}

/**
 * get results having playing_time that are past the current time
 * and whose results matches/events are discoverable
 * @returns {string}
 */
function createIsDiscoverableQuery() {
    var currentUnixTime = Math.round((new Date()).getTime() / 1000)
    console.log("the current unix timestamp -- " + currentUnixTime)
    var query = "value.playing_time:[" + currentUnixTime + " TO *]"  //this means greater than equalto
    //https://orchestrate.io/docs/apiref#search
    //matches that are not discoverable for any reason are set to isDiscoverable: false
    query = query + " AND value.isDiscoverable:true"
    return query
}

function recommendedQuery() {
    var currentUnixTime = Math.round((new Date()).getTime() / 1000)
    console.log("the current unix timestamp -- " + currentUnixTime)
    var query = "value.playing_time:[*" + " TO " + currentUnixTime + "]"  //this means greater than equalto
    //https://orchestrate.io/docs/apiref#search
    //matches that are not discoverable for any reason are set to isDiscoverable: false
    query = query + " AND NOT value.recommended:true AND value.slots_filled:[2 TO *]"
    return query
}

function matchWithinHourQuery() {
    var currentUnixTime = Math.round((new Date()).getTime() / 1000)
    console.log("the current unix timestamp -- " + currentUnixTime)
    var anHourLater = currentUnixTime + 3600
    var query = "value.playing_time:[" + currentUnixTime + " TO " + anHourLater + "]"  //this means greater than equalto
    //https://orchestrate.io/docs/apiref#search
    //matches that are not discoverable for any reason are set to isDiscoverable: false
    query = query + " AND NOT value.notified:true AND value.slots_filled:[2 TO *]"
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
    return dbUtils.createFieldORQuery(sportsArray, "value.sport")
}

/**
 * Crate a lucene OR query with the array of gender provided
 * @param genderArray
 * @returns {*}
 */
function createGenderQuery(genderArray) {
    var queries = []
    genderArray.forEach(function (gender) {
        switch (gender) {
            case "male":
                queries.push("value.hasMale:true")
                break
            case "female":
                queries.push("value.hasFemale:true")
                break
            case "other":
                queries.push("value.hasCustomGender:true")
                break
        }
    })
    console.log("final Query promse")
    console.log(queries)
    return dbUtils.queryJoinerOr(queries)
}

/**
 * assuming the field type is time
 */
// function createOnlyFutureTypeQuery() {
//     var currentUnixTime = Math.round(date.getTime() / 1000);
//     //this means greater than equalto
//     return "value.time: " + currentUnixTime + "~*"
// }

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
    console.log("incrementMatchesPlayed - " + userId)

    db.newPatchBuilder("users", userId)
        .inc("matchesPlayed", 1)
        .apply()
        .then(function (result) {
            console.log("db.newPatchBuilder - increment matches played" + userId)
        })
        .fail(function (err) {
            console.log("ERROR db.newPatchBuilder - increment matches played" + userId)
            console.log(err)
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
                    dbUtils.createGraphRelationPromise('users', userId, 'users', playerId, constants.graphRelations.users.looseConnections),
                    dbUtils.createGraphRelationPromise('users', playerId, 'users', userId, constants.graphRelations.users.looseConnections)
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
    console.log("createChatRoomForMatch : ")
    console.log(hostUserQbId)
    console.log(matchId)
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
    // return dbUtils.getGraphResultsPromise('users', userId, constants.graphRelations.users.playsMatches)
    return db.newGraphReader()
        .get()
        .offset(0)
        .limit(100)
        .from('users', userId)
        .related(constants.graphRelations.users.playsMatches)

}

function removeFromMatch(userId, matchId) {
    var ChatModel = require('../Chat/Chat')
    var UserModel = require('../models/User')
    var dbUtils = require('../dbUtils');
    var match
    var user
    return kew.all([
        dbUtils.deleteGraphRelationPromise('matches', matchId, 'users', userId, constants.graphRelations.matches.participants),
        dbUtils.deleteGraphRelationPromise('users', userId, 'matches', matchId, constants.graphRelations.users.playsMatches),
        getMatchPromise(matchId),
        UserModel.getUserPromise(userId)
    ])
        .then(function (results) {
            match = results[2].body
            user = results[3].body

            if (match.isDiscoverable == false)
                db.merge("matches", matchId, {isDiscoverable: true})

            return kew.all([
                ChatModel.removeUsersFromRoom(match.qbId, [results[3].body.qbId]),
                decrementSlotsFilled(matchId)
            ])
        })
        .fail(function (err) {
            console.log("removeFromMatch " + userId + " failed for match " + matchId)
        })
}

function getMatchChatRoom(matchId) {
    var chatRoomId = kew.defer()
    getMatchPromise(matchId)
        .then(function (result) {
            var theMatch = result.body
            chatRoomId.resolve(theMatch.qbId)
        })
        .fail(function (err) {
            chatRoomId.reject(err)
        })
    return chatRoomId
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
 *
 * NOTES: Match creation has been attempted to be nade fast
 * by sending a response before the chat channel is created,
 * now this can cause integrity problems if the chat creation fails.
 * make a choice whether to change this
 *
 * creates a match, creates its cha
 * @param payload
 * @param hostData
 */
function createMatch(payload, hostData, invitedUserIdList) {
    var matchCreated = kew.defer()
    payload = updateGenderInPayload(payload, hostData.gender)
    console.log("the sport is " + payload["sport"])
    console.log("the sport is " + constants.sportsCoverPics[payload["sport"]])
    payload["image"] = constants.sportsCoverPics[payload["sport"]]
    db.post('matches', payload)
        .then(function (result) {
            payload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];

            var promises = []

            var invitedUserList = []
            console.log("Invited userIds : ")
            console.log(invitedUserIdList)
            try {
                invitedUserList = invitedUserIdList.split(',')
            } catch (e) {
                //TODO : put this in the validation, this try catch should not exist
                console.log("malformed invited users")
            }
            invitedUserList.forEach(function (invitedUserId) {
                RequestModel.createInviteToMatchRequest(hostData.id, invitedUserId, payload, hostData.name)
            })

            if (payload.isFacility) {
                console.log("facility match detected")
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

            //var chatObj = {
            //    "created": date.getTime(),
            //    "type": "newChannel",
            //    "matchId": payload["id"],
            //    "pathTitle": reqBody.title
            //}
            dispatchers.newMatch(payload["id"], payload["title"], hostData["name"], hostData["phoneNumber"], hostData["username"], payload["sport"], payload["isFacility"])
            return kew.all(promises)
        })
        .then(function (result) {
            console.log("match creation fully complete")
            matchCreated.resolve(payload)
            // matchCreated.resolve()
        })
        .fail(function (err) {
            console.log("match creation failed")
            console.log("------------------")
            console.log(err)
            matchCreated.reject(err)
        })
    return matchCreated
}

function joinMatch(matchId, joineeId) {
    var joineeGender
    var joineeQBid
    var UserModel = require('../models/User');

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
        .then(function (results) {
            matchDetails = results[0].body
            joineeGender = results[1].body.gender
            joineeQBid = results[1].body.qbId

            if (matchDetails.slots == matchDetails.slots_filled)
                joinStatus.reject(new Error("The Match is already full. Please contact the host"))
            else {
                checkMatchParticipationPromise(matchId, joineeId)
                    .then(function (results) {
                        var count = results.body.count

                        if (count == 0) {
                            ChatModel.addUsersToRoom(matchDetails.qbId, [joineeQBid])
                                .then(function (result) {
                                    return kew.all([
                                        dbUtils.createGraphRelationPromise('matches', matchId, 'users', joineeId, constants.graphRelations.matches.participants),
                                        dbUtils.createGraphRelationPromise('users', joineeId, 'matches', matchId, constants.graphRelations.users.playsMatches)
                                    ])
                                })
                                .then(function (result) {
                                    incrementFilledSlots(matchDetails.slots, matchDetails.slots_filled)
                                    joinStatus.resolve()
                                    dispatchers.userAcceptsHostInvite(matchId, joineeId)
                                })
                                .fail(function (err) {
                                    joinStatus.reject(err)
                                })
                        } else {
                            joinStatus.reject(new Error("You are already part of this match"))
                        }
                    })
                    .fail(function (err) {
                        joinStatus.reject(err)
                    })
            }
        })
    return joinStatus
}

/**
 * inject isJoined flag
 * this flag tells if the user is part of the match/event
 * @param results a set of raw orchestrate results to inject flag into
 * @param userId
 * @returns {number|*|!Promise|Object}
 */
function injectIsJoined(results, userId, type) {
    /**
     * food for thought:
     * this bombs real bad if a match and an event share the same id
     * will there be a clash of ids?
     * but orchestrate ids are not as hardcore as UUIDs
     * this will then incorrectly show a match/event to be joined when its not :O
     * ya. quite unlikely but hey, why dont you do the math or handle the condition?
     * TODO : stay tuned
     * @type {!Promise}
     */
    var injectedResults = kew.defer()
    getMatchHistoryPromise(userId)
        .then(function (matches) {
            var theMatches = dbUtils.injectId(matches)
            var matchIds = theMatches.map(function (match) {
                return match.id
            })

            results.body.results = results.body.results.map(function (result) {
                if (matchIds.indexOf(result.path.key) > -1)
                    result.value.isJoined = true
                else
                    result.value.isJoined = false
                return result
            })
            injectedResults.resolve(results)
        })
        .fail(function (err) {
            injectedResults.reject(err)
        })
    return injectedResults
}

function getAdminMarkedCount() {
    return db.newSearchBuilder()
        .collection("matches")
        .limit(1)
        .offset(0)
        .query("value.isAdminMarked:true")
}

function getMatchesForReco() {
    var query = createIsDiscoverableQuery()
    return kew.all([
        dbUtils.getAllItemsWithFields("matches", query, ["value.title", "value.playing_time", "value.isDiscoverable:true"]),
        dbUtils.getAllItemsWithFields("matches", "@path.kind:item", "value.title")
    ])
}

function getDiscoverableMatchesCount() {
    var count = kew.defer()
    var query = createIsDiscoverableQuery()
    db.newSearchBuilder()
        .collection("matches")
        .limit(1)
        .offset(0)
        .query(query)
        .then(function (results) {
            count.resolve(results.body.total_count)
        })
        .fail(function (err) {
            count.reject(err)
        })
    return count
}

function decrementSlotsFilled(matchId) {
    console.log("decrement slots filled matches")
    db.newPatchBuilder("matches", matchId)
        .inc("slots_filled", -1)
        .apply()
}

function deleteMatch(matchId) {
    var deleteMatchStatus = kew.defer()
    if (matchId) {
        getMatchPromise(matchId)
            .then(function (result) {
                var theMatch = result.body
                return ChatModel.deleteRoom(theMatch.qbId)
            })
            .then(function (result) {
                return db.remove("matches", matchId, true)
            })
            .then(function (result) {
                deleteMatchStatus.resolve(result)
            })
            .fail(function (err) {
                deleteMatchStatus.reject(err)
            })
    } else {
        deleteMatchStatus.reject(new Error("id is missing"))
    }
    return deleteMatchStatus
}

module.exports = {
    getMatchParticipantsPromise: getMatchParticipantsPromise,
    createSportsQuery: createSportsQuery,
    getMatchHistoryPromise: getMatchHistoryPromise,
    // createOnlyFutureTypeQuery: createOnlyFutureTypeQuery,
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
    createMatch: createMatch,
    joinMatch: joinMatch,
    getMatchPromise: getMatchPromise,
    injectIsJoined: injectIsJoined,
    getFacilityOfMatchPromise: getFacilityOfMatchPromise,
    getFacilityPromise: getFacilityPromise,
    incrementMatchesPlayed: incrementMatchesPlayed,
    getAdminMarkedCount: getAdminMarkedCount,
    getMatchesForReco: getMatchesForReco,
    getDiscoverableMatchesCount: getDiscoverableMatchesCount,
    recommendedQuery: recommendedQuery,
    decrementSlotsFilled: decrementSlotsFilled,
    deleteMatch: deleteMatch,
    matchWithinHourQuery: matchWithinHourQuery
}