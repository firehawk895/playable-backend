//kardo sab import, node only uses it once
var config = require('../config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require('../utils.js');
var constants = require('../constants');
var qbchat = require('../Chat/qbchat');
var UserModel = require('../models/User');
var MatchModel = require('../models/Match');
//var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../notifications/dispatchers');
var kew = require('kew');

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
    var currentUnixTime = Math.round((new Date()).getTime() / 1000)
    /**
     * TODO: Red alert! can't put this outside! how!
     * no idea why in the world if this is outside the method this doesnt work
     */
    var MatchModel = require('../models/Match');
    var queries = []
    queries.push("value.isFeatured:true")
    queries.push("value.playing_time: " + currentUnixTime + "~*")
    var finalQuery = dbUtils.queryJoiner(queries)

    console.log("final featured events query")
    console.log(finalQuery)
    var featuredMatches = db.newSearchBuilder()
        .collection("events")
        .query(finalQuery)

    return featuredMatches
}

function getEventPromise(eventid) {
    return db.get('events', eventid)
}

function joinEvent(userId, eventId) {
    var joinedEventStatus = kew.defer()
    var theEventDetails
    var message
    getEventPromise(eventId)
        .then(function (theEvent) {
            theEventDetails = theEvent.body
            //Check if he has already joined the match
            return checkEventParticipationPromise(eventId, userId)
        })
        .then(function (results) {
            console.log("just checked event participation")
            var count = results.body.count
            // if (count == 0) {
                return kew.all([
                    dbUtils.createGraphRelationPromise('events', eventId, 'users', userId, constants.graphRelations.events.participants),
                    dbUtils.createGraphRelationPromise('users', userId, 'events', eventId, constants.graphRelations.users.playsMatches)
                ])
            // } else {
            //     return joinedEventStatus.reject(new Error("You are already part of this event. In case of any issues drop in a message from feedback chat"))
            // }
        })
        .then(function (result) {
            joinedEventStatus.resolve()
            /**
             * You are hoping that orchestrate handles concurrency
             * this sort of modification needs to be safe from race conditions,
             * but if you are solving this problem
             * Playable would have IPO'd
             */
            incrementSlotsFilled(eventId)
            EventSystem.joinedEvent(eventId, theEventDetails.title, userId, theEventDetails.google_form)
        })
        .fail(function (err) {
            console.log("entered error block")
            joinedEventStatus.reject(err)
        })
    return joinedEventStatus
}

function createNotFeaturedQuery() {
    return "value.isFeatured:false"
}

function createFeaturedQuery() {
    return "value.isFeatured:true"
}

function getEventParticipantsPromise(eventId) {
    return dbUtils.getGraphResultsPromise('events', eventId, constants.graphRelations.events.participants)
}

function incrementSlotsFilled(eventid) {
    console.log("incrementSlotsFilled event")
    db.newPatchBuilder("events", eventid)
        .inc("slots_filled", 1)
        .apply()
}

module.exports = {
    checkEventParticipationPromise: checkEventParticipationPromise,
    getFeaturedEventsPromise: getFeaturedEventsPromise,
    joinEvent: joinEvent,
    getEventParticipantsPromise: getEventParticipantsPromise,
    createNotFeaturedQuery : createNotFeaturedQuery,
    createFeaturedQuery : createFeaturedQuery
}
