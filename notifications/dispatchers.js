var express = require('express')
var router = express.Router()

var gcm = require('node-gcm');
var sender = new gcm.Sender(config.gcm.apiKey);
var message = new gcm.Message();
var config = mod('config')

var Firebase = require("firebase");
var notificationsRef = new Firebase(config.firebase.url, config.firebase.secret);

var NF = new NotificationFactory();
var date = new Date()

/**
 * Legend:
 * 'link' key to be used for information that allows to redirect inside the mobile app
 */

function welcome(userId) {
    var date = new Date();
    var titleString = "Hello " + data.name + "!";

    var nofObj = {
        "created": date.getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": '',
        "title": titleString,
        "text": "Welcome to Playable! We look forward to providing you a great playing experience :)",
        "photo": ""
    };
    NF.sendNotification(nofObj, [userId], null, type);
}

function newEvent(eventId, eventName) {
    var date = new Date();
    var titleString = "Hello " + data.name + "!";

    var nofObj = {
        "eventId": eventId,
        "created": date.getTime(),
        "is_clicked": false,
        "is_read": false,
        "link": '',
        "title": titleString,
        "text": "New event " + eventName + " hosted! Check it out now!",
        "photo": ""
    };
    NF.sendNotification(nofObj, [userId], null, type);
}

function requestToJoinMatch(requesterId, hostId) {

}


function NotificationFactory() {
    this.sendNotification = function (nofObj, recieverIds, recieverGcmIds, type) {
        //console.log("----------------nofObj : ----------------------")
        //console.log("----------------" + type)
        //console.log(nofObj)
        //console.log("receivers : ")
        //console.log(recieverIds)
        //console.log("receivers GCMs: ")
        //console.log(recieverGcmIds)
        switch (type) {
            case "both":
            {
                message.addData(nofObj);
                sender.send(message, recieverGcmIds, function (err, result) {
                    if (err) console.error(err);
                });
                recieverIds.forEach(function (recieverId) {
                    notificationsRef.child(recieverId + "/nof/").push().set(nofObj);
                    notificationsRef.child(recieverId + "/count").transaction(function (current_value) {
                        return (current_value || 0) + 1;
                    });
                })
                console.log("Both")
            }
                break;
            case "app":
            {
                recieverIds.forEach(function (recieverId) {
                    notificationsRef.child(recieverId + "/nof/").push().set(nofObj);
                    notificationsRef.child(recieverId + "/count").transaction(function (current_value) {
                        return (current_value || 0) + 1;
                    });
                })
                console.log("App")
            }
                break;
            case "push":
            {
                message.addData(nofObj);
                sender.send(message, recieverGcmIds, function (err, result) {
                    if (err) console.error(err);
                });
                console.log("Push")
            }
                break;
            default:
                console.log("Seriously, frontend?")
        }
    }
}


module.exports = {
    welcome : welcome,
    newEvent : newEvent
}