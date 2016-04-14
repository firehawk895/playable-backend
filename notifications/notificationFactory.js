/**
 * This factory classs handles the underlying implementation
 * of dispatching notifications
 * @type {*|exports}
 */
var gcm = require('node-gcm');
var config = require('../config.js');
var constants = require('../constants.js');
var sender = new gcm.Sender(config.gcm.apiKey);
var message = new gcm.Message();
var kew = require('kew')
var Firebase = require("firebase");
var myFirebaseRef = new Firebase(config.firebase.url + constants.notifications.path + "/", config.firebase.secret);


var send = function (obj, type, gcmIds, inappIds) {
    switch (type) {
        case constants.notifications.type.both:
            sendPush(obj, gcmIds)
            sendInApp(obj, inappIds)
            break;
        case constants.notifications.type.push:
            sendPush(obj, gcmIds)
            break;
        case constants.notifications.type.inApp:
            sendInApp(obj, inappIds)
            break;
        default:
        //go to inception limbo
    }
}

var sendPush = function (nofObj, gcmIds) {
    var pushSent = kew.defer()
    message.addData(nofObj);
    sender.send(message, gcmIds, function (err, result) {
        if (err) {
            console.log("push failed")
            pushSent.reject(err);
        }
        else {
            console.log("push sent")
            pushSent.resolve(result)
        }
    });
    return pushSent
}

var sendInApp = function (nofObj, inappIds) {
    inappIds.forEach(function (recieverId) {
        myFirebaseRef.child(recieverId + "/nof/").push().set(nofObj);
        myFirebaseRef.child(recieverId + "/count").transaction(function (current_value) {
            return (current_value || 0) + 1;
        });
    })
    console.log("App")
}

module.exports = {
    send: send
}