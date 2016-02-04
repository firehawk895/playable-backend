var express = require('express');
var router = express.Router();

var passport = require('passport');
customUtils = require('./utils.js');

var config = require('./config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var qbchat = require('./qbchat.js');
var kew = require('kew')
var Firebase = require("firebase");
var recommendationsRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests)

/**
 * Listener:
 * listen to requests marked by every user
 */
recommendationsRef.on("child_added", function (snapshot) {
    var userId = snapshot.key()
    var userRequestRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests + "/" + userId, config.firebase.secret)
    /**
     * Register a child_changed listener for one user's request
     * */
    userRequestRef.on("child_changed", function (childSnapshot, prevChildKey) {
        var requestObj = childSnapshot.val()
        customUtils.parseRequestObject(requestObj)
    })
})

module.exports = router;



