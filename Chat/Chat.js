//kardo sab import, node only uses it once
var config = require('../config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var constants = require('../constants');
// var qbchat = require('../Chat/qbchat');
var QuickBlox = require('quickblox').QuickBlox;
// var QB = new QuickBlox()

// var QB = require('quickblox').QuickBlox

var dbUtils = require('../dbUtils');
var kew = require('kew')
/**
 * /**
 * This is what a qbDialog looks like:
 //{ _id: '56794ff9a28f9ab1e5000374',
        //    created_at: '2015-12-22T13:28:25Z',
        //    last_message: null,
        //    last_message_date_sent: null,
        //    last_message_user_id: null,
        //    name: 'new concept',
        //    occupants_ids: [ 5372309, 7522231, 7522239, 7522718, 7523428, 7523544, 7533504 ],
        //    photo: null,
        //    silent_ids: [],
        //    type: 2,
        //    updated_at: '2015-12-24T15:17:36Z',
        //    user_id: 5372309,
        //    xmpp_room_jid: '28196_56794ff9a28f9ab1e5000374@muc.chat.quickblox.com',
 //    unread_messages_count: 0 }
 * @param username
 * @param mentorRoomList
 * @param callback
 */
var getUsersDialogs = function (username, callback) {
    var params = {
        'login': username,
        'password': config.qb.defaultPassword
    }

    /**
     * Old hack now solved (apparently)
     * disable require cache to get a new QB object for consumer
     * so that the sessions dont clash!
     ***/
    // Object.keys(require.cache).forEach(function (key) {
    //     //delete require.cache[key]
    //     if (key.indexOf("node_modules/quickblox") > -1) {
    //         //console.log(key)
    //         delete require.cache[key]
    //     }
    // })

    var QBconsumer = new QuickBlox();
    QBconsumer.init(config.qb.appId, config.qb.authKey, config.qb.authSecret, false);
    console.log("Im here")
    QBconsumer.createSession(params, function (err, session) {
        if (err) {
            console.log({customMessage: "createSession failed for user", username: username, qbError: err})
            callback(err, null)
        } else {
            QBconsumer.chat.dialog.list({limit: config.qb.paginationLimit, skip: 0}, function (err, res) {
                if (err) {
                    log.error({customMessage: "getDialoges failed for user", username: username, qbError: err})
                    callback(err, null)
                } else {
                    callback(null, res.items)
                }
            })
        }
    })
}

function createGroupChatRoom(roomName) {
    console.log("creating group room chat")
    var newChatRoom = kew.defer()
    getSession()
        .then(function (result) {
            QB.chat.dialog.create({type: 2, name: roomName}, function (err, newRoom) {
                if (err) {
                    newChatRoom.reject(err)
                    console.log("error creating the one on one room")
                    console.log(err);
                }
                else {
                    newChatRoom.resolve(newRoom)
                }
            });
            // qbchat.createRoom(2, roomName, function (err, newRoom) {
            //     if (err) {
            //         newChatRoom.reject(err)
            //         console.log("error creating the one on one room")
            //         console.log(err);
            //     }
            //     else {
            //         newChatRoom.resolve(newRoom)
            //     }
            // })
        })
        .fail(function (err) {
            newChatRoom.reject(err)
        })
    return newChatRoom
}

function addUsersToRoom(newRoomQbId, arrayOfQbIds) {
    console.log("adding users to room")
    console.log(newRoomQbId)
    console.log(arrayOfQbIds)
    var joined = kew.defer()
    getSession()
        .then(function (result) {
            QB.chat.dialog.update(newRoomQbId, {push_all: {occupants_ids: arrayOfQbIds}},
                function (err, result) {
                    if (err) {
                        console.log(err);
                        joined.reject(err)
                    } else {
                        joined.resolve(result)
                    }
                }
            );
        })
        .fail(function (err) {
            joined.reject(err)
        })
    return joined
}

function removeUsersFromRoom(roomId, arrayOfUserIds) {
    console.log("removing users from room")
    console.log(roomId)
    console.log(arrayOfUserIds)
    var removed = kew.defer()
    getSession()
        .then(function (result) {
            QB.chat.dialog.update(roomId, {pull_all: {occupants_ids: arrayOfUserIds}},
                function (err, result) {
                    if (err) {
                        console.log("removeUsersFromRoom error")
                        console.log(err)
                        removed.reject(err)
                    } else {
                        removed.resolve(result)
                    }
                }
            );
        })
        .fail(function (err) {
            console.log("removeUsersFromRoom error")
            console.log(err)
            removed.reject(err)
        })
    return removed
}

function deleteRoom(roomId) {
    console.log("deleteRoom")
    console.log(roomId)
    var deleted = kew.defer()
    getSession()
        .then(function (result) {
            QB.chat.dialog.delete(roomId,
                function (err, result) {
                    if (err) {
                        deleted.reject(err)
                    } else {
                        deleted.resolve(result)
                    }
                }
            );
        })
        .fail(function (err) {
            deleted.reject(err)
        })
    return deleted
}

function getSession() {
    // var qbchat = require('../Chat/qbchat');
    console.log("getting the session")
    var sessionStatus = kew.defer()
    // console.log('about to QB init')

    QB.getSession(function(err, session) {
        if(err) {
            console.log("QB session doesnt exist, recreating")
            QB.createSession(config.qb.params, function (err, session) {
                QB.createSession(config.qb.params, function (err, session) {
                    if (err) {
                        console.log(err)
                        console.log("eh whats going on?")
                        sessionStatus.reject(err)
                        //customUtils.sendErrors(["Can't connect to the chat server, try again later"], 503, res)
                    } else {
                        console.log("resolvng")
                        sessionStatus.resolve(session)
                    }
                });
            })
        } else {
            sessionStatus.resolve(session)
        }
    })

    // QB.init(config.qb.appId, config.qb.authKey, config.qb.authSecret, false);

    // console.log("QB.createSession")
    // QB.createSession(config.qb.params, function (err, session) {
    //     if (err) {
    //         console.log(err)
    //         console.log("eh whats going on?")
    //         sessionStatus.reject(err)
    //         //customUtils.sendErrors(["Can't connect to the chat server, try again later"], 503, res)
    //     } else {
    //         console.log("resolvng")
    //         sessionStatus.resolve(session)
    //     }
    // });

    // qbchat.getSession(function (err, session) {
    //     if (err) {
    //         console.log("unfortunately always recreating the  session");
    //         qbchat.createSession(function (err, result) {
    //             if (err) {
    //                 console.log(err)
    //                 sessionStatus.reject(err)
    //                 //customUtils.sendErrors(["Can't connect to the chat server, try again later"], 503, res)
    //             } else {
    //                 sessionStatus.resolve(result)
    //             }
    //         })
    //     } else {
    //         console.log("session mil gaya")
    //         sessionStatus.resolve(session)
    //     }
    // })
    return sessionStatus
}

module.exports = {
    getUsersDialogs: getUsersDialogs,
    createGroupChatRoom: createGroupChatRoom,
    addUsersToRoom: addUsersToRoom,
    deleteRoom: deleteRoom,
    removeUsersFromRoom : removeUsersFromRoom
}

