var express = require('express');
var router = express.Router();

var constants = require('../constants')
var multer = require('multer');
var passport = require('passport');
customUtils = require('../utils.js');

var config = require('../config.js');
//var config = require('../models/Match.js');
var validation = require('../validations/Match.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var async = require('async');


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
                customUtils.getMatchHistoryPromise(userId)
                    .then(function (results) {
                        console.log("and this")
                        callback(null, results)

                    })
                    .fail(function (err) {
                        callback(err, null)
                    })
            },
            function (callback) {
                customUtils.getUsersConnectionsPromise(userId)
                    .then(function (results) {
                        console.log("how about this")
                        callback(null, results)
                    })
                    .fail(function (err) {
                        callback(err, null)
                    })

            },
            function (callback) {
                customUtils.getUsersDialogs(username, function (err, results) {
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
                var matchHistory = customUtils.injectId(results[0])
                var matchHistoryMap = {}
                matchHistory.forEach(function (match) {
                    matchHistoryMap[match.id] = match
                })

                //-------- Connections Map --------------------------
                var connections = customUtils.injectId(results[1])
                var connectionsMap = {}
                connections.forEach(function (connection) {
                    connectionsMap[connection["id"]] = connection
                })

                //-------- make the sweet chat objects --------------
                //-------- makhan parsed for the front end ----------

                var dialogs = results[2]

                var chatObjects = {}
                chatObjects["oneOnOne"] = []
                chatObjects["matches"] = []

                dialogs.forEach(function (dialog) {
                    var chatObj = {
                        dialog: dialog
                    }
                    if (dialog.name.indexOf(constants.chats.oneOnOne) > -1) {
                        var theUserId = getOpponentUser(userId)
                        chatObj["user"] = connectionsMap[theUserId]
                        chatObjects["oneOnOne"].push(chatObj)
                    } else if (dialog.name.indexOf(constants.chats.matchRoom) > -1) {
                        var theMatchId = getMatchId(dialog.name)
                        chatObj["match"] = matchHistoryMap[theMatchId]
                        chatObjects["matches"].push(chatObj)
                    }
                })
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








