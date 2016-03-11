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
var EventSystem = require(__base + './events/events');

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
    dbUtils.createGraphRelation('matches', matchId, 'facilities', facilityId, constants.graphRelations.matches.hostedFacility)
    dbUtils.createGraphRelation('facilities', facilityId, 'matches', matchId, constants.graphRelations.matches.hasMatches)
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
    var checkMatchParticipation =
        db.newSearchBuilder()
            .query(dbUtils.createGetOneOnOneGraphRelationQuery('matches', matchId, constants.graphRelations.matches.participants, 'users', userId))
    return checkMatchParticipation
}

function incrementMatchesPlayed(userId) {
    db.get("users", userId)
        .then(function (result) {
            var matchesPlayed = result.body.matchesPlayed;
            db.merge("users", userId, {
                matchesPlayed: matchesPlayed + 1
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
        //console.log(aResult["value"]["distance"])
    })
    console.log(newResults)
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
    db.newGraphReader()
        .get()
        .from('matches', matchId)
        .related(constants.graphRelations.matches.participants)
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
                dbUtils.createGraphRelation('users', userId, 'users', playerId, constants.graphRelations.users.connections)
                dbUtils.createGraphRelation('users', playerId, 'users', userId, constants.graphRelations.users.connections)
            })
        })
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
    //TODO: this should be abstracted out into a Chat model that hides this implementation
    qbchat.createRoom(2, constants.chats.matchRoom + ":::" + matchId, function (err, newRoom) {
        if (err) {
            console.log("error creating the room")
            console.log(err);
        }
        else {
            console.log("bro add ho gaya bro")
            console.log(hostUserQbId)
            qbchat.addUserToRoom(newRoom._id, [hostUserQbId], function (err, result) {
                if (err) {
                    console.log("error making the dude join the room")
                    console.log(err);
                } else {
                    console.log("bro add ho gaya bro")
                    db.merge('matches', matchId, {"qbId": newRoom._id})
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
            })
        }
    });
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
        dbUtils.deleteGraphRelation('matches', matchId, 'users', userId, constants.graphRelations.matches.participants),
        dbUtils.deleteGraphRelation('users', userId, 'matches', matchId, constants.graphRelations.users.playsMatches)
    ])
}

module.exports = {
    getMatchParticipantsPromise : getMatchParticipantsPromise,
    createSportsQuery : createSportsQuery,
    getMatchHistoryPromise : getMatchHistoryPromise,
    createOnlyFutureTypeQuery : createOnlyFutureTypeQuery,
    connectFacilityToMatch : connectFacilityToMatch
}