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
    var date = new Date()
    var currentUnixTime = Math.round(date.getTime() / 1000)
    /**
     * TODO: Red alert! can't put this outside! how!
     * no idea why in the world if this is outside the method this doesnt work
     */
    var MatchModel = require('../models/Match');
    var queries = []
    queries.push("value.isFeatured:true")
    queries.push("value.playing_time: " + currentUnixTime + "~*"  )
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
    getEventPromise(eventId)
        .then(function (theEvent) {
            theEventDetails = theEvent
            console.log(theEvent.body)
            console.log("what")
            //Check if he has already joined the match
            return checkEventParticipationPromise(eventId, userId)
        })
        .then(function (results) {
            console.log(results.body)
            console.log("just checked event participation")
            var count = results.body.count
            if (count == 0) {
                console.log("user determined to be not participating in event")
                return kew.all([
                    dbUtils.createGraphRelationPromise('events', eventId, 'users', userId, constants.graphRelations.events.participants),
                    dbUtils.createGraphRelationPromise('users', userId, 'events', eventId, constants.graphRelations.users.playsMatches)
                ])
            } else {
                return joinedEventStatus.reject(new Error("You are already part of this event. Roll back any payments if made."))
            }
        })
        .then(function (result) {
            /**
             * You are hoping that orchestrate handles concurrency
             * this sort of modification needs to be safe from race conditions,
             * but if you are solving this problem
             * Playable would have IPO'd
             */
                console.log(theEventDetails.slots_filled)
                var slotsFilled = theEventDetails.slots_filled + 1
                var payload = {
                    'slots_filled': slotsFilled
                }

                db.merge('events', eventId, payload)
                joinedEventStatus.resolve()
                EventSystem.joinedEvent()
        })
        .fail(function(err) {
            joinedEventStatus.reject(err)
        })

    return joinedEventStatus
}

function getEventParticipantsPromise(eventId) {
    return dbUtils.getGraphResultsPromise('events', eventId, constants.graphRelations.events.participants)
}

module.exports = {
    checkEventParticipationPromise: checkEventParticipationPromise,
    getFeaturedEventsPromise: getFeaturedEventsPromise,
    joinEvent : joinEvent,
    getEventParticipantsPromise : getEventParticipantsPromise
}
