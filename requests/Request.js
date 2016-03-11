var constants = require(__base + './constants.js');
var qbchat = require(__base + './Chat/qbchat');
var UserModel = require(__base + './models/User');
var MatchModel = require(__base + './models/Match');
var EventModel = require(__base + './models/Event');
var RequestModel = require(__base + './requests/Request');
var dbUtils = require(__base + './dbUtils');
var EventSystem = require(__base + './events/events');

/**
 * create a connection request from user1 to user2
 * @param user1id
 * @param user2id
 * @returns {*}
 */
function createConnectionRequest(user1id, user2id, user1name, user1photo) {
    createConnectionRequestInvite(user1id, user2id, user1name, user1photo)
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
    createMatchRequestInvite(user1id, user2id, matchPayload, user1name)
    return kew.all([
        dbUtils.createGraphRelationPromise('users', user1id, 'users', user2id, constants.graphRelations.users.requestedToConnect),
        dbUtils.createGraphRelationPromise('users', user2id, 'users', user1id, constants.graphRelations.users.waitingToAccept)
    ])
}

function createInvitedToMatchRequest() {

}

/**
 * Internal methods:
 */

/**
 * Create the invite when a 1 on 1 connect request is sent
 * @param user1id
 * @param user2id
 */
function createConnectionRequestInvite(user1id, user2id, user1name, user1photo) {
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
}

/**
 * Create the invite when a 'fix a match' request is sent
 * pretty much like 1 on 1 connect request, with the extra match
 * @param user1id the requester
 * @param user2id the invitee
 * @param matchPayload the match to be created
 */
function createMatchRequestInvite(user1id, user2id, matchPayload, user1name) {
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
}

/**
 * This is the request sent when someone invites a user to a match
 * @param hostId
 * @param inviteeId
 * @param matchPayload
 * @param matchSport
 */
function createInvitedToMatchRequest(hostId, inviteeId, matchPayload, hostName) {
    //matchPayload requirements:
    //matchPayload = {
    //  id :
    //  sport :
    //}
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
                EventModel.dispatchEvent(constants.events.matches)
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
    createInvitedToMatchRequest : createInvitedToMatchRequest,
    acceptConnectionRequest: acceptConnectionRequest,
    parseRequestObject: parseRequestObject
}