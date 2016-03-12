//kardo sab import, node only uses it once
var config = require(__base + 'config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require('../utils.js');
var constants = require('../constants');
var qbchat = require('../Chat/qbchat');
var UserModel = require('../models/User');
var MatchModel = require('../models/Match');
//var EventModel = require(__base + 'models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');
console.log("yay")

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
    /**
     * TODO: Red alert! can't put this outside! how!
     * no idea why in the world if this is outside the method this doesnt work
     */
    var MatchModel = require('../models/Match');
    var queries = []
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
