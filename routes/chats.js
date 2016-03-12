var express = require('express');
var router = express.Router();

var multer = require('multer');
var passport = require('passport');

var validation = require('../validations/Match.js');
var async = require('async');

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
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');
var ChatModel = require('../Chat/Chat');

router.get('/', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var responseObj = {}
    var userId = req.user.results[0].value.id;
    var username = req.user.results[0].value.username;

    //What you should be doing here is converting the quickblox callback
    //into a promise and avoid asyncing this completely
    //oh yeah btw, quickblox sucks. lots of problems in doing the getDialogs call
    //from the android front end, so we came up with the shitty but problem solving
    //idea where we let the dialogs come from the backend
    async.parallel([
            function (callback) {
                MatchModel.getMatchHistoryPromise(userId)
                    .then(function (results) {
                        console.log("and this")
                        callback(null, results)

                    })
                    .fail(function (err) {
                        callback(err, null)
                    })
            },
            function (callback) {
                UserModel.getUsersConnectionsPromise(userId)
                    .then(function (results) {
                        console.log("how about this")
                        callback(null, results)
                    })
                    .fail(function (err) {
                        callback(err, null)
                    })

            },
            function (callback) {
                ChatModel.getUsersDialogs(username, function (err, results) {
                    if (err) {
                        callback(err, null)
                    } else {
                        console.log("ok this worked")
                        callback(null, results)
                    }
                })
            }
        ],
        // optional callback
        function (err, results) {
            if (err) {
                console.log(err)
                customUtils.sendErrors(["Retreiving chats failed"], 503, res)
            } else {
                //results[0] match history
                //results[1] get users connection
                //results[2] get user dialogs

                //--------- Match History Map -----------------------
                var matchHistory = dbUtils.injectId(results[0])
                var matchHistoryMap = {}
                matchHistory.forEach(function (match) {
                    matchHistoryMap[match.id] = match
                })

                //-------- Connections Map --------------------------
                var connections = dbUtils.injectId(results[1])
                var connectionsMap = {}
                connections.forEach(function (connection) {
                    connectionsMap[connection["id"]] = connection
                })

                //-------- make the sweet chat objects --------------
                //-------- makhan parsed for the front end ----------

                var dialogs = results[2]
                console.log(dialogs)

                var chatObjects = {}
                chatObjects["oneOnOne"] = []
                chatObjects["matches"] = []

                dialogs.forEach(function (dialog) {
                    var chatObj = {
                        dialog: dialog
                    }
                    if (dialog.name.indexOf(constants.chats.oneOnOne) > -1) {
                        console.log("oneoneone")
                        var theUserId = getOpponentUser(userId)
                        chatObj["user"] = connectionsMap[theUserId]
                        chatObjects["oneOnOne"].push(chatObj)
                    } else if (dialog.name.indexOf(constants.chats.matchRoom) > -1) {
                        console.log("matchRoom")
                        var theMatchId = getMatchId(dialog.name)
                        chatObj["match"] = matchHistoryMap[theMatchId]
                        console.log(chatObj)
                        chatObjects["matches"].push(chatObj)
                    }
                })
                responseObj = chatObjects
                res.status(200)
                res.json(responseObj)
            }
        });
}])

/**
 * the dialog title has meta information
 * we need. This method extracts that
 * @param matchRoomName
 * @returns {*}
 */
function getMatchId(matchRoomName) {
    var components = matchRoomName.split(":::")
    var matchId = components[1]
    console.log("extracted matchId " + matchId)
    return matchId
}

/**
 * the dialog title of a OneOnOne Room
 * has the 2 userIds, given one userId it
 * returns the other
 * @param userId
 * @param connectionRoomName
 */
function getOpponentUser(userId, connectionRoomName) {
    var components = connectionRoomName.split(":::")
    var user1id = components[1]
    var user2id = components[2]

    if (userId.substring(user1id) > -1)
        return user2id
    else
        return user1id
}


module.exports = router








