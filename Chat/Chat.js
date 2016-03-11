var config = require(__base + './config.js');
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
     * disable require cache to get a new QB object for consumer
     * so that the sessions dont clash!
     * TODO: find a better way to do this. perhaps create an instance of QB
     ***/
    Object.keys(require.cache).forEach(function (key) {
        //delete require.cache[key]
        if (key.indexOf("node_modules/quickblox") > -1) {
            //console.log(key)
            delete require.cache[key]
        }
    })

    var QBconsumer = require('quickblox');
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

modules.export = {
    getUsersDialogs : getUsersDialogs
}

