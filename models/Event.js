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

function checkEventParticipationPromise(eventId, userId) {
    var checkEventParticipationPromise =
        db.newSearchBuilder()
            .query(dbUtils.createGetOneOnOneGraphRelationQuery('events', eventId, 'participants', 'users', userId))
    return checkEventParticipationPromise
}

/**
 * get featured matches
 * @returns {SearchBuilder} promise
 */
function getFeaturedEventsPromise() {
    var queries = new Array()
    queries.push("value.isFeatured:true")
    queries.push(MatchModel.createIsDiscoverableQuery())
    var finalQuery = dbUtils.queryJoiner(queries)
    var featuredMatches = db.newSearchBuilder()
        .collection("events")
        .query(finalQuery)

    return featuredMatches
}

module.exports = {
    checkEventParticipationPromise : checkEventParticipationPromise,
    getFeaturedEventsPromise : getFeaturedEventsPromise
}