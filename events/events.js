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
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');

var Firebase = require('firebase')
var myFirebaseRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests)

var kew = require('kew')
var date = new Date()

/**
 * Now the question is who maintains the data format??
 * let firebase have it
 * @param event
 * @param data
 */
//function emit(event, data) {
//    //inject timestamp into the events
//    data.timestamp = date.getTime()
//    pushEvent(event, data)
//}
//
//function pushEvent(node, data) {
//    var nodeRef = new firebase(config.firebase.url + "/" + node)
//    nodeRef.push().set(data)
//}

/**
 * dispatch event to firebase,
 * where the world can listen to
 * @param type
 * @param payload
 */
function dispatchEvent(type, payload) {
    payload[constants.events.timestampkey] = date.getTime()
    myFirebaseRef.child(type).push().set(payload)
}


exports = {
    dispatchEvent : dispatchEvent
}