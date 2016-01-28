var config = require('./config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var QB = require('quickblox');

exports.init = function() {
    QB.init(config.qb.appId, config.qb.authKey, config.qb.authSecret, false);
};

exports.createSession = function(cb) {
    QB.createSession(config.qb.params, function (err, session) {
        cb(err, session)
    });
};

exports.createUser = function(params, cb) {
    QB.users.create(params, function(err, newUser) {
        cb(err, newUser);
    });
};

exports.updateUser = function(id, params, cb) {
    QB.users.update(id, params, function(err, user) {
        cb(err, user);
    });
};


exports.createRoom = function(type, name, cb) {
    QB.chat.dialog.create({type: type, name: name}, function(err, newRoom) {
        cb(err, newRoom);
    });
};

exports.addUserToRoom = function(roomId, userIds, cb) {
    QB.chat.dialog.update(roomId, {push_all: {occupants_ids: userIds}},
        function(err, result) {
            cb(err, result)
        }
    );
};

exports.changeRoomName = function(roomId, newName, cb) {
    QB.chat.dialog.update(roomId, {name: newName},
        function(err, result) {
            cb(err, result);
        }
    );
};

exports.deleteRoom = function(roomId, cb) {
    QB.chat.dialog.delete(roomId,
        function(err, result) {
            cb(err, result);
        }
    );
};

exports.getSession = function(cb) {
    QB.getSession(function(err, res) {
        cb(err, res);
    })
};

exports.getUsers = function(users, cb){
    var params = {filter: { field: 'id', param: 'in', value: users }};
 
    QB.users.listUsers(params, function(err, result){
        cb(err, result);
    });
}