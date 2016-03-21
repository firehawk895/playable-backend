//kardo sab import, node only uses it once
var config = require('../config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require('../utils.js');
var constants = require('../constants');
var qbchat = require('../Chat/qbchat');
//var UserModel = require('../models/User');
var MatchModel = require('../models/Match');
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');
var ChatModel = require('../Chat/Chat');
var kew = require('kew');

/**
 * basic query to display users in the users discover section
 * the user should appear only when he has selected his interested sports
 * also, exclude the searching user itself from the results
 * @param userId
 * @returns {string}
 */
function createPlayerDiscoverableQuery(userId) {
    var query = "value.hasSelectedSports:true AND @path.key:* NOT " + userId
    return query
}

/**
 * get a promise of the user's connections
 * @param userId
 * @returns {GraphBuilder}
 */
function getUsersConnectionsPromise(userId) {
    return dbUtils.getGraphResultsPromise('users', userId, constants.graphRelations.users.connections)
}

/**
 *
 * @param userId
 */
function getUserPromise(userId) {
    return db.get('users', userId)
}

/**
 * create a connection between two users
 * who have accepted each others request
 * @param user1id
 * @param user2id
 * @returns {number|*|!Promise|Object}
 */
function createConnection(user1id, user2id) {
    var connectionCreated = kew.defer()
    var promises = [
        getUserPromise(user1id),
        getUserPromise(user2id),
        dbUtils.createGraphRelationPromise('users', user1id, 'users', user2id, constants.graphRelations.users.connections),
        dbUtils.createGraphRelationPromise('users', user2id, 'users', user1id, constants.graphRelations.users.connections),
    ]

    var user1QBid
    var user2QBid
    kew.all(promises)
        .then(function (results) {
            user1QBid = results[0].qbId
            user2QBid = results[1].qbId
            var chatRoomName = constants.chats.oneOnOne + ":::" + user1id + ":::" + user2id
            return ChatModel.createGroupChatRoom(chatRoomName)
            //qbchat.createRoom(2, , function (err, newRoom) {
            //    if (err) {
            //        console.log("error creating the one on one room")
            //        console.log(err);
            //    }
            //    else {
            //        qbchat.addUserToRoom(newRoom._id, [user1QBid, user2QBid], function (err, result) {
            //            if (err) console.log(err);
            //        })
            //    }
            //})
        })
        .then(function(newChatRoom) {
            return ChatModel.addUsersToRoom(newChatRoom._id, [user1QBid, user2QBid])
        })
        .then(function(joinedRoomStatus) {
            return connectionCreated.resolve(joinedRoomStatus)
        })
        .fail(function(err) {
            connectionCreated.reject(err)
        })
    return connectionCreated
}

function getConnectionStatusPromise(user1id, user2id) {
    var connectionStatus = kew.defer()
    kew.all([checkIfConnected(user1id, user2id), checkIfRequestedToConnect(user1id, user2id), checkIfWaitingToAccept(user1id, user2id)])
        .then(function (results) {
            if (results[0])
                connectionStatus = connectionStatus.resolve(constants.connections.status.connected)
            else if (results[1])
                connectionStatus = connectionStatus.resolve(constants.connections.status.requestedToConnect)
            else if (results[2])
                connectionStatus = connectionStatus.resolve(constants.connections.status.waitingToAccept)
            else
                connectionStatus = connectionStatus.resolve(constants.connections.status.none)
        })
    return connectionStatus
}

function checkIfRequestedToConnect(user1id, user2id) {
    var thePromise = kew.defer()
    var query = dbUtils.createGetOneOnOneGraphRelationQuery('users', user1id, constants.graphRelations.users.requestedToConnect, 'users', user2id)
    db.newSearchBuilder()
        .collection('users')
        .query(query)
        .then(function (result) {
            if (result.body.count == 1) {
                thePromise.resolve(true)
            } else {
                thePromise.resolve(false)
            }
        })
        .fail(function (err) {
            thePromise.reject(err)
        })
    return thePromise
}

function checkIfWaitingToAccept(user1id, user2id) {
    var thePromise = kew.defer()
    var query = dbUtils.createGetOneOnOneGraphRelationQuery('users', user1id, constants.graphRelations.users.waitingToAccept, 'users', user2id)
    db.newSearchBuilder()
        .collection('users')
        .query(query)
        .then(function (result) {
            if (result.body.count == 1) {
                thePromise.resolve(true)
            } else {
                thePromise.resolve(false)
            }
        })
        .fail(function (err) {
            thePromise.reject(err)
        })
    return thePromise
}

function checkIfConnected(user1id, user2id) {
    var thePromise = kew.defer()
    var query = dbUtils.createGetOneOnOneGraphRelationQuery('users', user1id, constants.graphRelations.users.connections, 'users', user2id)
    db.newSearchBuilder()
        .collection('users')
        .query(query)
        .then(function (result) {
            if (result.body.count == 1) {
                thePromise.resolve(true)
            } else {
                thePromise.resolve(false)
            }
        })
        .fail(function (err) {
            thePromise.reject(err)
        })
    return thePromise
}

/**
 *
 * @param userId
 * @returns {number|*|!Promise}
 */
function getTotalConnections(userId) {
    var totalConnectionsDefer = kew.defer()
    dbUtils.getGraphResultsPromise("users", userId, constants.graphRelations.users.connections)
        .then(function (result) {
            kew.resolve(result.body.count)
        })
        .fail(function (err) {
            kew.reject(err)
        })
    return totalConnectionsDefer
}

/**
 *
 * @param userIdList
 * @returns {!Promise}
 */
function getGcmIdsForUserIds(userIdList) {
    var gcmUserIds = kew.defer();
    var queries = []
    userIdList.forEach(function (userId) {
        queries.push(dbUtils.createSearchByIdQuery(userId))
    })

    var theFinalQuery = dbUtils.queryJoiner(queries)

    db.newSearchBuilder()
        .collection("users")
        //.sort('location', 'distance:asc')
        .query(theFinalQuery)
        .then(function (result) {
            var gcmUserIds = result.body.results.map(function (user) {
                return user.value.gcmId
            });
            kew.resolve(gcmUserIds)
        })
        .fail(function (err) {
            kew.reject(err)
        })

    return gcmUserIds
}

function getUserPromise(userId) {
    return db.get('users', userId)
}

module.exports = {
    getConnectionStatusPromise : getConnectionStatusPromise,
    getTotalConnections : getTotalConnections,
    getUsersConnectionsPromise : getUsersConnectionsPromise,
    createPlayerDiscoverableQuery : createPlayerDiscoverableQuery,
    createConnection : createConnection,
    getUserPromise : getUserPromise,
    getGcmIdsForUserIds : getGcmIdsForUserIds
}