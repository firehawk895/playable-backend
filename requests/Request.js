var constants = require('../constants.js');
var config = require('../config.js');
var qbchat = require('../Chat/qbchat');
var UserModel = require('../models/User');
var MatchModel = require('../models/Match');
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');
var Firebase = require("firebase");
var date = new Date()
var kew = require('kew')

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
    var payload = {
        fromUserId: hostId,
        toUserId: inviteeId,
        type: constants.requests.type.invite,
        status: constants.requests.status.pending,
        photo: "",
        msg: hostName + " has invited you to play a game of " + matchPayload.sport + " with you",
        match: matchPayload,
        timestamp: date.getTime()
    }
    pushRequestToFirebase(payload, inviteeId)
}

/**
 * a match has been hosted, a user requests to join it
 * @param requesterId
 * @param matchId
 */
function createRequestToJoinMatch(requesterId, matchId) {

}


/**
 * the connection request sent from user1 to user2 is now
 * accepted by user2
 * refer : createConnectionRequest
 * user2 accepts user1
 * @param user1id
 * @param user2id
 */
function acceptConnectionRequest(user1id, user2id) {
    dbUtils.deleteGraphRelation('users', user1id, 'users', user2id, constants.graphRelations.users.waitingToAccept)
    dbUtils.deleteGraphRelation('users', user2id, 'users', user1id, constants.graphRelations.users.requestedToConnect)
    UserModel.createConnection(user1id, user2id)
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
            parseConnectRequest(requestObj)
            break;
        case constants.requests.type.match:
            parseMatchRequest(requestObj)
            break;
        default:
    }
}

/**
 * refer to createMatchRequestInvite for the format of requestObj
 * @param requestObj
 */
function parseMatchRequest(requestObj) {
    acceptMatchRequest(requestObj.fromUserId, requestObj.toUserId, requestObj.match)
    //make them a connection
    //is the create match reusable?
    //create a match with the specified stuff
    //make them join the match

    function createThatFixAmatchKaMatch() {

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
    dbUtils.deleteGraphRelation('users', user1id, 'users', user2id, constants.graphRelations.users.requestedToConnect)
    dbUtils.deleteGraphRelation('users', user2id, 'users', user1id, constants.graphRelations.users.waitingToAccept)
    createConnection(user1id, user2id)
    function createOneOnOneFixAmatch(user1id, matchPayload) {
        db.post('matches', matchPayload)
            .then(function (result) {
                matchPayload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                if (matchPayload.isFacility) {
                    MatchModel.connectFacilityToMatch(matchPayload["id"], matchPayload["facilityId"])
                }
                /**
                 * The numerous graph relations are so that we
                 * can access the related data from any entry point
                 */
                    //The user hosts the match
                dbUtils.createGraphRelation('users', user1id, 'matches', matchPayload["id"], constants.graphRelations.users.hostsMatch)
                //The user plays in the match
                dbUtils.createGraphRelation('users', user1id, 'matches', matchPayload["id"], constants.graphRelations.users.playsMatches)
                //The match is hosted by user
                dbUtils.createGraphRelation('matches', matchPayload["id"], 'users', user1id, constants.graphRelations.matches.isHostedByUser)
                //The match has participants (user)
                dbUtils.createGraphRelation('matches', matchPayload["id"], 'users', user1id, constants.graphRelations.matches.participants)

                MatchModel.createChatRoomForMatch(user1id, matchPayload["id"])
                EventSystem.dispatchEvent(constants.events.matches.created)
                //notifyMatchCreated(matchPayload["id"], matchPayload["playing_time"])
            })
    }

    createOneOnOneFixAmatch(user1id, matchPayload)
}

function parseConnectRequest(requestObj) {
    acceptConnectionRequest(requestObj.toUserId, requestObj.fromUserId)
}

module.exports = {
    createConnectionRequest: createConnectionRequest,
    createMatchRequest: createMatchRequest,
    createInviteToMatchRequest: createInviteToMatchRequest,
    acceptConnectionRequest: acceptConnectionRequest,
    parseRequestObject: parseRequestObject
}