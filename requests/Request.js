var constants = require('../constants.js');
var config = require('../config.js');
var qbchat = require('../Chat/qbchat');
var UserModel = require('../models/User');
var MatchModel = require('../models/Match');
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');
var Dispatchers = require('../notifications/dispatchers');
var customUtils = require('../utils');
var Firebase = require("firebase");
var date = new Date()
var kew = require('kew')

var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

/**
 * create a connection request from user1 to user2
 * @param user1id
 * @param user2id
 * @returns {*}
 */
function createConnectionRequest(user1id, user2id, user1name, user1photo) {
    var payload = {
        fromUserId: user1id,
        toUserId: user2id,
        type: constants.requests.type.connect,
        status: constants.requests.status.pending,
        msg: user1name + " has requested to connect with you",
        photo: user1photo,
        timestamp: date.getTime()
    }
    Dispatchers.pushRequestNotification(payload["msg"], payload["timestamp"], user2id)
    pushRequestToFirebase(payload, user2id)
    return kew.all([
        dbUtils.createGraphRelationPromise('users', user1id, 'users', user2id, constants.graphRelations.users.requestedToConnect),
        dbUtils.createGraphRelationPromise('users', user2id, 'users', user1id, constants.graphRelations.users.waitingToAccept)
    ])
}

/**
 * 'fix a match' request user1 to user2
 * @param user1id
 * @param user2id
 */
function createMatchRequest(user1id, user2id, matchPayload, user1name) {
    console.log("createMatchRequest")
    var payload = {
        fromUserId: user1id,
        toUserId: user2id,
        type: constants.requests.type.match,
        status: constants.requests.status.pending,
        photo: "",
        msg: user1name + " wants to play a game of " + matchPayload.sport + " with you",
        match: matchPayload,
        timestamp: date.getTime()
    }
    Dispatchers.pushRequestNotification(payload["msg"], payload["timestamp"], user2id)
    pushRequestToFirebase(payload, user2id)
    return kew.all([
        dbUtils.createGraphRelationPromise('users', user1id, 'users', user2id, constants.graphRelations.users.requestedToConnect),
        dbUtils.createGraphRelationPromise('users', user2id, 'users', user1id, constants.graphRelations.users.waitingToAccept)
    ])
}

/**
 * The host of a match while creating or editing a match
 * invites users to join in
 * @param hostId
 * @param inviteeId
 * @param matchPayload
 * @param hostName
 */
function createInviteToMatchRequest(hostId, inviteeId, matchPayload, hostName) {
    /**
     * Expectations :
     * wait is there a better way to design this?
     * objects passed reduce the number of arguments but hide the details of the object
     * increasing complexity and allowing the possibility of errors.
     * probably even making a not so clean interface
     *
     * matchPayload = {
     *      id
     *      sport
     * }
     */
    var payload = {
        fromUserId: hostId,
        toUserId: inviteeId,
        type: constants.requests.type.invite,
        status: constants.requests.status.pending,
        photo: "",
        msg: hostName + " has invited you to play a game of " + matchPayload.sport + " with you",
        match: {
            id: matchPayload.id
        },
        timestamp: date.getTime()
    }
    Dispatchers.pushRequestNotification(payload["msg"], payload["timestamp"], inviteeId)
    pushRequestToFirebase(payload, inviteeId)
}

/**
 * a match has been hosted, a user requests to join it
 * @param requesterId
 * @param matchId
 */
function createRequestToJoinMatch(hostId, requesterId, matchPayload, requesterName, requesterPhoto) {
    //matchPayload expected to have : id, sport, playing_time
    var formatted = customUtils.getFormattedDate(matchPayload.playing_time)
    // var formatted = t.format("dd.mm.yyyy hh:MM:ss");

    var payload = {
        fromUserId: requesterId,
        toUserId: hostId,
        type: constants.requests.type.join,
        status: constants.requests.status.pending,
        photo: requesterPhoto,
        msg: requesterName + " wants to join your game of " + matchPayload.sport + " on " + formatted,
        match: matchPayload,
        timestamp: date.getTime()
    }
    Dispatchers.pushRequestNotification(payload["msg"], payload["timestamp"], hostId)
    pushRequestToFirebase(payload, hostId)
}

/**
 * the connection request sent from user1 to user2 is now
 * accepted by user2
 * refer : createConnectionRequest
 * user2 accepts user1
 * @param user1id
 * @param user2id
 * @returns {!Promise.<!Array>}
 */
function acceptConnectionRequest(user1id, user2id) {
    var UserModel = require('../models/User');
    return kew.all([
        dbUtils.deleteGraphRelationPromise('users', user1id, 'users', user2id, constants.graphRelations.users.waitingToAccept),
        dbUtils.deleteGraphRelationPromise('users', user2id, 'users', user1id, constants.graphRelations.users.requestedToConnect),
        UserModel.createConnection(user1id, user2id)
    ])
}

/**
 * Push a request to Firebase user tree
 * @param jsonPayload
 * @param userId
 */
function pushRequestToFirebase(jsonPayload, userId) {
    var newRequestRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests + "/" + userId)
    newRequestRef.child("data").push().set(jsonPayload)
    newRequestRef.child("count").transaction(function (current_value) {
        return (current_value || 0) + 1; //what a cool piece of code :)
    });
}

/**
 * Listened to a "accepted" request event
 * Now do the needful for each type of request
 * @param requestObj
 */
function parseRequestObject(requestObj) {
    switch (requestObj.type) {
        case constants.requests.type.connect:
            console.log("connect request detected")
            return parseConnectRequest(requestObj)
            break
        case constants.requests.type.match:
            console.log("match request detected")
            return parseMatchRequest(requestObj)
            break
        //not required to parse - android will parse invite requests and auto join
        //case constants.requests.type.invite:
        //    return parseInviteToMatchRequest(requestObj)
        //    break
        case constants.requests.type.join:
            console.log("I want to join your match request detected")
            return parseJoinMatchRequest(requestObj)
            break
        default:
    }
}

/**
 * refer to createMatchRequestInvite for the format of requestObj
 * @param requestObj
 */
function parseMatchRequest(requestObj) {
    if (requestObj.status == constants.requests.status.accepted) {
        acceptMatchRequest(requestObj.fromUserId, requestObj.toUserId, requestObj.match)
    } else {
        //nothing on rejection
    }
}

function parseInviteToMatchRequest(requestObj) {

}

function parseJoinMatchRequest(requestObj) {
    var MatchModel = require('../models/Match')
    console.log("parseJoinMatchRequest")
    console.log(requestObj)
    if (requestObj.status == constants.requests.status.accepted) {
        console.log("accepting join match request")
        acceptJoinMatchRequest(requestObj.fromUserId, requestObj.toUserId, requestObj.match)
    } else {
        console.log("rejecting join match request")
        rejectJoinMatchRequest(requestObj.fromUserId, requestObj.toUserId, requestObj.match)
    }

    function acceptJoinMatchRequest(fromUserId, toUserId, matchPayload) {
        console.log("about to join match " + matchPayload["id"])
        console.log("and this user is being joined" + fromUserId)
        MatchModel.joinMatch(matchPayload["id"], fromUserId)
            .then(function (result) {
                Dispatchers.acceptJoinMatchRequest(fromUserId, toUserId, matchPayload)
                //what to do?
                console.log("")
            })
            .fail(function (err) {
                //what to do?
            })
    }

    function rejectJoinMatchRequest(fromUserId, toUserId, matchPayload) {
        //dispatch some negetive notification
    }
}

/**
 * the 'fix a match' request sent from user1 to user2 is now
 * accepted by user2
 * refer : createMatchRequest
 * user2 accepts user1's match request
 * @param user1id
 * @param user2id
 */
function acceptMatchRequest(user1id, user2id, matchPayload) {
    console.log("acceptMatchRequest : ")
    console.log("   user1id : " + user1id)
    console.log("   user2id : " + user2id)
    var UserModel = require('../models/User')
    var MatchModel = require('../models/Match')
    var dbUtils = require('../dbUtils');
    var oio = require('orchestrate');
    oio.ApiEndPoint = config.db.region;
    var db = oio(config.db.key);

    return kew.all([
        dbUtils.deleteGraphRelationPromise('users', user1id, 'users', user2id, constants.graphRelations.users.requestedToConnect),
        dbUtils.deleteGraphRelationPromise('users', user2id, 'users', user1id, constants.graphRelations.users.waitingToAccept)
    ])
        .then(function (result) {
            return createOneOnOneFixAmatch(user1id, matchPayload)
        })
        .then(function (result) {
            console.log("accepting OneOnOneFixAmatch fully done")
        })
        .fail(function (err) {
            console.log(err)
            console.log("accepting OneOnOneFixAmatch failed, attempt to reparse")
        })

    function createOneOnOneFixAmatch(user1id, matchPayload) {
        console.log("here is the match payload being created : ")
        console.log(matchPayload)
        var createOneOnOneFixAmatchStatus = kew.defer()
        return db.post('matches', matchPayload)
            .then(function (result) {
                matchPayload["id"] = dbUtils.getIdAfterPost(result)
                if (matchPayload.isFacility) {
                    MatchModel.connectFacilityToMatch(matchPayload["id"], matchPayload["facilityId"])
                }
                /**
                 * The numerous graph relations are so that we
                 * can access the related data from any entry point
                 */
                var promises = []
                //The user hosts the match
                promises.push(dbUtils.createGraphRelationPromise('users', user1id, 'matches', matchPayload["id"], constants.graphRelations.users.hostsMatch))
                //The user plays in the match
                promises.push(dbUtils.createGraphRelationPromise('users', user1id, 'matches', matchPayload["id"], constants.graphRelations.users.playsMatches))
                //The match is hosted by user
                promises.push(dbUtils.createGraphRelationPromise('matches', matchPayload["id"], 'users', user1id, constants.graphRelations.matches.isHostedByUser))
                //The match has participants (user)
                promises.push(dbUtils.createGraphRelationPromise('matches', matchPayload["id"], 'users', user1id, constants.graphRelations.matches.participants))
                promises.push(MatchModel.createChatRoomForMatch(matchPayload["host"]["id"], matchPayload["id"]))

                return kew.all(promises)
                //notifyMatchCreated(matchPayload["id"], matchPayload["playing_time"])
            })
            .then(function (results) {
                createOneOnOneFixAmatchStatus.resolve(results)
                Dispatchers.acceptMatchRequest(user1id, user2id, matchPayload)
                //not doing this anymore, we run a cron, because a match time can change
                // EventSystem.dispatchEvent(constants.events.matches.created, matchPayload)
                return UserModel.getConnectionStatusPromise(user1id, user2id)
            })
            .then(function (result) {
                if (result != constants.connections.status.connected) {
                    UserModel.createConnection(user1id, user2id)
                }
            })
            .fail(function(err) {
                createOneOnOneFixAmatchStatus.reject(err)
            })
        return createOneOnOneFixAmatchStatus
    }
    // createOneOnOneFixAmatch(user1id, matchPayload)
}

function parseConnectRequest(requestObj) {
    if (requestObj.status == constants.requests.status.accepted) {
        acceptConnectionRequest(requestObj.toUserId, requestObj.fromUserId)
            .then(function (results) {
                console.log("acceptConnectionRequest success")
                Dispatchers.acceptConnectionRequest(requestObj.toUserId, requestObj.fromUserId)
            })
            .fail(function (err) {
                console.log("acceptConnectionRequest failed")
                console.log(err)
            })
    } else {
        //no action so far
    }
}

function markParsedByBackend(firebasePath, payload) {

}

module.exports = {
    createConnectionRequest: createConnectionRequest,
    createMatchRequest: createMatchRequest,
    createInviteToMatchRequest: createInviteToMatchRequest,
    acceptConnectionRequest: acceptConnectionRequest,
    parseRequestObject: parseRequestObject,
    createRequestToJoinMatch: createRequestToJoinMatch,
}