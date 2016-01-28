var util = require('util');
var customUtils = require('./utils.js');
var config = require('./config.js');

var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var request = require('request');

var gcm = require('node-gcm');
var sender = new gcm.Sender(config.gcm.apiKey);
var message = new gcm.Message();
// message.addData({"hello": "akshay"});
// sender.send(message, ["dUuNnJEPbpU:APA91bFrIa-vL31Kz-eYQaQsp66WXa7rUNOFUbyguhrek3Df_uib4ik216meUQ5-ufH2_fFqqaF5w9e6OsNzGmM5id18FrwEtEQPKJWTdKbPJ1EdvYWzatpnyoW49uXHVVnf9W9RBSN2"], function (err, result) {
//   if(err) console.error(err);
//   else    console.log(result);
// });

var Firebase = require("firebase");
var myFirebaseRef = new Firebase(config.firebase.url, config.firebase.secret);

var EventEmitter = require('events').EventEmitter;
var NF = new NotificationFactory();

function Notifications() {
    EventEmitter.call(this);

    // this.on('enrolment', function(data){
    // 	var recieverIds = [];
    // 	var recieverGcmIds = [];
    // 	var type = "app";

    // 	var date = new Date();
    // 	var nofObj = {
    // 		"created": date.getTime(),
    // 		"id": date.getTime(),
    // 		"is_clicked": false,
    // 		"is_read": false,
    // 		"link": data.where,
    // 		"title": "New User enroled in your path"
    // 	};
    // 	recieverIds.push(data.producerId);
    // 	recieverGcmIds.push(data.producerGcmId);

    // 	NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);
    // });

    this.on('welcome', function (data) {
        var recieverIds = [];
        var recieverGcmIds = [];
        var type = "app";
        var date = new Date();
        var titleString = "Hello " + data.name + "!";

        var nofObj = {
            "created": date.getTime(),
            "id": date.getTime(),
            "is_clicked": false,
            "is_read": false,
            "link": 'Dashboard',
            "title": titleString,
            "text": "Welcome to Pyoopil! We look forward to providing you a great learning experience :)",
            "photo": "https://s3-ap-southeast-1.amazonaws.com/pyoopil-tssc-files/pyoopil-logo.png"
        };
        NF.sendNotification(nofObj, [data.user], recieverGcmIds, type);
    });

    this.on('newConcept', function (data) {
        //var recieverIds = [];
        //var recieverGcmIds = [];
        var type = "both";
        var date = new Date();
        db.get('paths', data.pathId)
            .then(function (pathRes) {
                var path = pathRes.body;
                var nofObj = {
                    "created": date.getTime(),
                    "id": date.getTime(),
                    "is_clicked": false,
                    "is_read": false,
                    "link": data.pathId,
                    "title": "New Concept",
                    "text": path.producer.name + " has added a new concept " + data.conceptName + " in the course " + path.title,
                    "photo": path.coverPhotoThumb
                };

                //db.newGraphReader()
                //    .get()
                //    .limit(100)
                //    .from('paths', data.pathId)
                //    .related('isConsumed')
                //    .then(function (result) {
                //        recieverIds = result.body.results.map(function (user) {
                //            return user.value.id
                //        });
                //        recieverGcmIds = result.body.results.map(function (user) {
                //            return user.value.gcmId
                //        });
                //    })
                //    .then(function () {
                //        NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);
                //    })
                firePathConsumerNotifs(0, data.pathId, nofObj, type)
            })
            .fail(function (err) {
                console.log(err.body.message);
            });

    });

    this.on('newObject', function (data) {
        //var recieverIds = [];
        //var recieverGcmIds = [];
        var type = "app";

        var date = new Date();
        db.get('paths', data.pathId)
            .then(function (pathRes) {
                var path = pathRes.body;
                var nofObj = {
                    "created": date.getTime(),
                    "id": date.getTime(),
                    "is_clicked": false,
                    "is_read": false,
                    "link": data.pathId,
                    "index": data.conceptIndex,
                    "title": "New Content",
                    "text": path.producer.name + " has added a new " + data.objectType + " to the concept " + path.concepts[data.conceptIndex].title + " in the course " + path.title,
                    "photo": path.coverPhotoThumb
                };

                //db.newGraphReader()
                //    .get()
                //    .limit(100)
                //    .from('paths', data.pathId)
                //    .related('isConsumed')
                //    .then(function (result) {
                //        recieverIds = result.body.results.map(function (user) {
                //            return user.value.id
                //        });
                //    })
                //    .then(function () {
                //        NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);
                //    })
                firePathConsumerNotifs(0, data.pathId, nofObj, type)
            })
            .fail(function (err) {
                console.log(err.body.message);
            });
    });


    // this.on('pathEdited', function(data){
    // 	var recieverIds = [];
    // 	var recieverGcmIds = [];
    // 	var type = "app";

    // 	var date = new Date();
    // 	var nofObj = {
    // 		"created": date.getTime(),
    // 		"id": customUtils.randomizer(),
    // 		"is_clicked": false,
    // 		"is_read": false,
    // 		"link": data.where,
    // 		"title": "Some Path Settings were changed"
    // 	};

    // 	db.newGraphReader()
    //         .get()
    //         .from('paths', data.where)
    //         .related('isConsumed')
    //         .then(function (result) {
    //         	recieverIds = result.body.results.map(function(user) {
    //         		return user.value.id
    //         	});
    //         })
    //         .then(function() {
    //         	NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);
    //         })
    //         .fail(function (err) {
    //             console.log(err.body.message);
    //         });
    // });

    this.on('newPath', function (data) {
        var type = "app";

        var date = new Date();
        var nofObj = {
            "created": date.getTime(),
            "id": date.getTime(),
            "is_clicked": false,
            "is_read": false,
            "link": data.pathId,
            "title": "New Course",
            "text": data.producerName + " has published a new course - " + data.pathTitle + ". Check it out!",
            "photo": data.producerPhoto
        };

        var notificationDispatcher = function (offset) {
            var recieverIds = [];
            var recieverGcmIds = [];

            var promiseResult;

            db.newGraphReader()
                .get()
                .limit(config.pagination.limit)
                .offset(offset)
                .from('users', data.producerId)
                .related('produces', 'isConsumed')
                .then(function (result) {
                    recieverIds = result.body.results.map(function (user) {
                        return user.value.id
                    });
                    promiseResult = result
                })
                .then(function () {
                    NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);
                    offset += config.pagination.limit;
                    //the prev key appears on the last "page" of the results
                    if (promiseResult.body.prev === undefined) {
                        notificationDispatcher(offset);
                    }
                })
                .fail(function (err) {
                    console.log(err.body.message);
                });
        }
        notificationDispatcher(0);
    });


    this.on('mentorMaybe', function (data) {
        var type = "both";

        var date = new Date();
        var nofObj = {
            "created": date.getTime(),
            "id": date.getTime(),
            "is_clicked": false,
            "is_read": false,
            "link": data.userId,
            "title": "Your Mentor is online",
            "text": data.name + " is online, do not miss out on this engagement!",
            "photo": data.photo
        };

        var notificationDispatcher = function (offset) {
            var recieverIds = [];
            var recieverGcmIds = [];
            var promiseResult;
            db.newGraphReader()
                .get()
                .limit(config.pagination.limit)
                .offset(offset)
                .from('users', data.userId)
                .related('produces', 'isConsumed')
                .then(function (result) {
                    /**
                     * check if the course has mentorAvailable = false
                     * skip sending mentor is online notifications for that path
                     */
                    recieverIds = result.body.results.map(function (user) {
                        return user.value.id
                    });
                    recieverGcmIds = result.body.results.map(function (user) {
                        return user.value.gcmId
                    });
                    promiseResult = result
                })
                .then(function () {
                    NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);

                    db.newPatchBuilder("users", data.userId)
                        .add("last_seen", date.getTime())
                        .apply()
                        .then(function (result) {

                        })
                    offset += config.pagination.limit;
                    //the prev key appears on the last "page" of the results
                    if (promiseResult.body.prev === undefined) {
                        notificationDispatcher(offset);
                    }
                })
                .fail(function (err) {
                    console.log(err.body.message);
                });
        }

        checkIfMentorAvailable(data.userId, function (err, mentorAvailable) {
            if (mentorAvailable) {
                notificationDispatcher(0)
            }
        })
    });

    this.on('atClass', function (data) {
        console.log('notification.js : notification emit recieved atClass');
        console.log("notification.js : data received : ")
        console.log(data)

        var type = "both";

        var date = new Date();

        //db.newGraphReader()
        //    .get()
        //    .limit(100)
        //    .from('paths', data.pathId)
        //    .related('isConsumed')
        //    .then(function (result) {
        //        recieverIds = result.body.results.map(function (user) {
        //            return user.value.id
        //        });
        //        recieverGcmIds = result.body.results.map(function (user) {
        //            return user.value.gcmId
        //        });
        //    })
        //    .then(function () {
        //        NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);
        //    })

        var notificationDispatcher = function (offset) {
            var receiverIds = [];
            var receiverGcmIds = [];

            console.log("notification.js : the offset is : ")
            console.log(offset)
            db.newGraphReader()
                .get()
                .limit(config.pagination.limit)
                .offset(offset)
                .from('paths', data.channelDetails[2])
                .related('isConsumed')
                .then(function (result) {
                    result.body.results.forEach(function (user) {
                        if (user.value.id != data.senderUserId) {
                            receiverIds.push(user.value.id);
                            receiverGcmIds.push(user.value.gcmId);
                        }
                    });
                    console.log("notification.js : dispatch to users : ")
                    console.log(receiverIds);
                    db.get('users', data.senderUserId)
                        .then(function (user) {
                            var nofObj = {
                                "created": data.timestamp,
                                "id": date.getTime(),
                                "is_clicked": false,
                                "is_read": false,
                                "pathId": data.channelDetails[2],
                                "link": data.dialogId,
                                "title": "@class",
                                "text": user.body.name + " has called for your attention in #" + data.channelDetails[1] + " in the course " + data.channelDetails[0],
                                "photo": user.body.avatarThumb
                            };

                            console.log("notification.js : drumroll, the final nof object is")
                            console.log(nofObj)

                            console.log("firing now----");
                            NF.sendNotification(nofObj, receiverIds, receiverGcmIds, type);
                            offset += config.pagination.limit;
                            //the prev key appears on the last "page" of the results
                            if (result.body.prev === undefined) {
                                notificationDispatcher(offset);
                            }
                        })
                        .fail(function (err) {
                            console.log(err.body.message)
                        })
                })
        }
        notificationDispatcher(0);
    });

    this.on('newAnnouncement', function (data) {
        var type = "both";
        var date = new Date();
        db.get('paths', data.pathId)
            .then(function (pathRes) {
                var path = pathRes.body;
                var nofObj = {
                    "created": date.getTime(),
                    "id": date.getTime(),
                    "is_clicked": false,
                    "is_read": false,
                    "link": data.pathId,
                    "title": "Announcement",
                    "text": path.title + ": " + data.announcementDesc,
                    "photo": "https://s3-ap-southeast-1.amazonaws.com/pyoopil-tssc-files/announcement.png"
                };

                //db.newGraphReader()
                //    .get()
                //    .limit(100)
                //    .from('paths', data.pathId)
                //    .related('isConsumed')
                //    .then(function (result) {
                //        recieverIds = result.body.results.map(function (user) {
                //            return user.value.id
                //        });
                //        recieverGcmIds = result.body.results.map(function (user) {
                //            return user.value.gcmId
                //        });
                //    })
                //    .then(function () {
                //        NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);
                //    })
                firePathConsumerNotifs(0, data.pathId, nofObj, type)
            })
            .fail(function (err) {
                console.log(err.body.message);
            });
    });

    this.on('feedbackResponse', function (data) {
        var type = "both";
        var date = new Date();

        console.log(data)

        var nofObj = {
            "created": date.getTime(),
            "id": date.getTime(),
            "is_clicked": false,
            "is_read": false,
            "link": "Feedback Channel",
            "title": "Response for your Feedback",
            "text": "You got a response from Pyoopil Team : " + data.text,
            "photo": "https://s3-ap-southeast-1.amazonaws.com/pyoopil-tssc-files/pyoopil-logo.png"
        };

        if (data.type == "singleUser") {
            console.log("singleUser wala feedback notification detected for username " + data.username)
            db.newSearchBuilder()
                .collection('users')
                .query('value.username:`' + data.username + '`')
                .then(function (result) {
                    console.log("result.body.total_count > 0 -- " + result.body.total_count)
                    if (result.body.total_count > 0) {
                        user = result.body.results[0].value;
                        NF.sendNotification(nofObj, [user.id], [user.gcmId], type);
                    } else {
                        request.post(config.newSlack.feedbackHook, {
                            body: JSON.stringify({text: "User nahi mila bhai, chasma pehen lo"})
                        })
                    }
                })
                .fail(function (err) {
                    console.log(err.body.message);
                });
        } else if (data.type == "Everyone") {
            console.log("Warning! This is a global notification pusher!")
            everyoneNotificationDispatcer(0, nofObj, "push")
        } else if (data.type == "Classroom") {
            console.log("Classroom notif - ")
            console.log(data.pathId)
            firePathConsumerNotifs(0, data.pathId, nofObj, "both")
        }
    });

    this.on('enrolmentAggregate', function (data) {
        var type = "both";
        var date = new Date();

        if (data.newStudents == 1)
            var text = "1 New Person joined your learning track \"" + data.pathName + "\" in the past day. Welcome him!";
        else
            var text = newStudents + " New People joined your learning track \"" + data.pathName + "\" in the past day. Welcome them!";

        var nofObj = {
            "created": date.getTime(),
            "id": date.getTime(),
            "is_clicked": false,
            "is_read": false,
            "link": data.pathId,
            "title": "New Enrolments in \"" + data.pathName + "\"",
            "text": text,
            "photo": data.pathPhoto
        };

        NF.sendNotification(nofObj, [data.producerId], [data.producerGcmId], type);

    });

    this.on('newMention', function (data) {
        var type = "both";
        var date = new Date();

        db.get('users', data.senderUserId)
            .then(function (user) {
                var text = "You have been mentioned by " + data.senderType + " " + user.body.name + " in the channel \"" + data.channelDetails[1] + "\" in the learning track \"" + data.channelDetails[0] + "\""

                var nofObj = {
                    "created": data.timestamp,
                    "id": date.getTime(),
                    "is_clicked": false,
                    "is_read": false,
                    "pathId": data.channelDetails[2],
                    "link": data.dialogId,
                    "title": "You have been mentioned!",
                    "text": user.body.name + " has mentioned you in #" + data.channelDetails[1] + " in the course " + data.channelDetails[0],
                    "photo": user.body.avatarThumb
                };
                NF.sendNotification(nofObj, data.receiverIds, data.receiverGcmIds, type);
            })
            .fail(function (err) {
                console.log(err.body.message)
            })
    });

    this.on('newMentorMessage', function (data) {
        var type = "both";
        var date = new Date();
        db.get('users', data.senderUserId)
            .then(function (user) {
                var text = "Your Mentor " + user.body.name + " sent a message in the channel \"" + data.channelDetails[1] + "\" in the learning track \"" + data.channelDetails[0] + "\""

                var nofObj = {
                    "created": data.timestamp,
                    "id": date.getTime(),
                    "is_clicked": false,
                    "is_read": false,
                    "pathId": data.channelDetails[2],
                    "link": data.dialogId,
                    "title": "New message from Mentor!",
                    "text": user.body.name + " has sent a message in #" + data.channelDetails[1] + " in the course " + data.channelDetails[0],
                    "photo": user.body.avatarThumb
                };

                console.log("-----mentor message dispatcher-------")
                var notificationDispatcher = function (offset) {
                    var recieverIds = [];
                    var recieverGcmIds = [];
                    console.log("offset value -- " + offset)
                    db.newGraphReader()
                        .get()
                        .limit(config.pagination.limit)
                        .offset(offset)
                        .from('paths', data.channelDetails[2])
                        .related('isConsumed')
                        .then(function (result) {
                            console.log("result.body looks like: ")
                            console.log(result.body)
                            var users = result.body.results;
                            for (var i = 0; i < users.length; i++) {
                                if (data.onlineUsers.indexOf(users[i].value.qbId.toString()) == -1) {
                                    recieverIds.push(users[i].value.id)
                                    recieverGcmIds.push(users[i].value.gcmId)
                                }
                            }
                            console.log("lets recurse --------")
                            console.log(recieverIds)
                            NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);
                            offset += config.pagination.limit;
                            //the prev key appears on the last "page" of the results
                            if (result.body.prev === undefined) {
                                notificationDispatcher(offset);
                            }
                        })
                        .fail(function (err) {
                            console.log(err.body.message)
                        })
                }
                notificationDispatcher(0);
            })
            .fail(function (err) {
                console.log(err.body.message)
            })
    });

    this.on('wordForChat', function (data) {
        data["id"] = data["id"] + "@0"
        myFirebaseRef.child("chatServer/addToCache/" + data.id).set(data);
    })

    /**
     * This is a timed notification to inform the App
     * that it needs to calculate the user's unread notification
     */
        //this.on('chatAggregate', function (data) {
        //    var date = new Date();
        //    var nofObj = {
        //        "created": date.getTime(),
        //        "id": date.getTime(),
        //        "is_clicked": false,
        //        "is_read": false,
        //        "link": "Dashboard",
        //        "title": "Chat Aggregate",
        //        "text": "You have unread chats inside your courses",
        //        "photo": "https://s3-ap-southeast-1.amazonaws.com/pyoopil-tssc-files/pyoopil-logo.png"
        //    };
        //    everyoneNotificationDispatcer(0, nofObj, "push")
        //})

    this.on('unreadMessageCount', function (data) {
        //Expected data
        /**
         * data = {
         *      userGcmId : 12312313,
         *      unreadCount : 24
         * }
         */
        var date = new Date();
        var nofObj = {
            "created": date.getTime(),
            "id": date.getTime(),
            "is_clicked": false,
            "is_read": false,
            "link": "Dashboard",
            "title": "Unread Chats",
            "text": "You have " + data.unreadCount + " unread chats inside your courses",
            "photo": "https://s3-ap-southeast-1.amazonaws.com/pyoopil-tssc-files/pyoopil-logo.png"
        };
        NF.sendNotification(nofObj, null, [data.userGcmId], "push");
    })
}

var everyoneNotificationDispatcer = function (offset, nofObj, type) {
    var params = {
        limit: config.pagination.limit,
        offset: offset
    }
    db.search('users', "*", params)
        .then(function (result) {
            recieverIds = result.body.results.map(function (user) {
                return user.value.id
            });

            recieverGcmIds = result.body.results.map(function (user) {
                return user.value.gcmId
            });

            NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);

            if (result.body.next) {
                everyoneNotificationDispatcer(offset + config.pagination.limit, nofObj, type)
            }
        })
        .fail(function (err) {
            console.log(err.body.message);
        });
}

/**
 * This method fires notification for all consumers of a path
 * -------------------------------------------------------------
 * body Output looks like this:
 * -------------------------------------------------------------
 * { count: 100,
     *   results: [ [Object], [Object], [Object], [Object], [Object] ],
     *   next: '/v0/paths/0c3484518b604c4a/relations/isConsumed?offset=5&limit=5' }
 * -------------------------------------------------------------
 * body output of last page looks like this :
 * -------------------------------------------------------------
 * { count: 6,
     *    results:
     *     [ { path: [Object], value: [Object], reftime: 1443207278236 },
     *       { path: [Object], value: [Object], reftime: 1443570411674 },
     *       { path: [Object], value: [Object], reftime: 1444221122617 },
     *       { path: [Object], value: [Object], reftime: 1441017432260 },
     *       { path: [Object], value: [Object], reftime: 1442519236121 },
     *       { path: [Object], value: [Object], reftime: 1441017791823 } ],
     *    prev: '/v0/paths/0c3484518b604c4a/relations/isConsumed?offset=0&limit=100' }
 *
 *    Also:
 *    http://stackoverflow.com/questions/28250680/how-do-i-access-previous-promise-results-in-a-then-chain
 *    using the simplest - sharing promise values with higher scope
 *
 * @param offset
 * @param pathId
 */
var firePathConsumerNotifs = function (offset, pathId, nofObj, type) {
    var recieverIds = [];
    var recieverGcmIds = [];
    var promiseResult;

    db.newGraphReader()
        .get()
        .limit(config.pagination.limit)
        .offset(offset)
        .from('paths', pathId)
        .related('isConsumed')
        .then(function (result) {
            promiseResult = result;
            recieverIds = result.body.results.map(function (user) {
                return user.value.id
            });
            recieverGcmIds = result.body.results.map(function (user) {
                return user.value.gcmId
            });
        })
        .then(function () {
            console.log("Firing notifs to : ")
            console.log(recieverIds)
            console.log(recieverGcmIds)

            NF.sendNotification(nofObj, recieverIds, recieverGcmIds, type);
            offset += config.pagination.limit;
            //the prev key appears on the last "page" of the results
            if (promiseResult.body.prev === undefined) {
                firePathConsumerNotifs(offset, pathId, nofObj, type);
            }
        })
};

util.inherits(Notifications, EventEmitter);

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
                    myFirebaseRef.child(recieverId + "/nof/" + nofObj.id).set(nofObj);
                    myFirebaseRef.child(recieverId + "/count").transaction(function (current_value) {
                        return (current_value || 0) + 1;
                    });
                })
                console.log("Both")
            }
                break;

            case "app":
            {
                recieverIds.forEach(function (recieverId) {
                    myFirebaseRef.child(recieverId + "/nof/" + nofObj.id).set(nofObj);
                    myFirebaseRef.child(recieverId + "/count").transaction(function (current_value) {
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

Notifications.prototype.getRecieversAndUpdatePhotos = function (type, dbId, newPhoto, oldPhoto) {
    if (type == 'path') {
        var getConsumerRecievers = function (type, dbId, newPhoto, offset) {
            var receiverIds = [];
            db.newGraphReader()
                .get()
                .limit(config.pagination.limit)
                .offset(offset)
                .from('paths', dbId)
                .related('isConsumed')
                .then(function (result) {
                    receiverIds = result.body.results.map(function (user) {
                        return user.value.id
                    });
                    db.newGraphReader()
                        .get()
                        .limit(config.pagination.limit)
                        .from('paths', dbId)
                        .related('isProduced')
                        .then(function (result2) {
                            receiverIds.push(result2.body.results[0].value.id)
                            updatePhotosPath(receiverIds, dbId, newPhoto);
                        })
                        .fail(function (err) {
                            console.log(err.body.message)
                        })

                    if (result.body.prev === undefined) {
                        offset += config.pagination.limit
                        getConsumerRecievers(type, dbId, newPhoto, offset);
                    }
                })
                .fail(function (err) {
                    console.log(err.body.message)
                })
        }
        getConsumerRecievers(type, dbId, newPhoto, 0)
    } else if (type == 'user') {
        var getUserReceivers = function (type, dbId, newPhoto, oldPhoto, offset) {
            var recieverIds = []
            db.newGraphReader()
                .get()
                .limit(config.pagination.limit)
                .offset(offset)
                .from('users', dbId)
                .related('related', 'isConsumed')
                .then(function (result) {
                    recieverIds = result.body.results.map(function (user) {
                        return user.value.id
                    });
                    var recieverIds2;
                    db.newGraphReader()
                        .get()
                        .limit(config.pagination.limit)
                        .from('users', dbId)
                        .related('related', 'isProduced')
                        .then(function (result2) {
                            recieverIds2 = result2.body.results.map(function (user) {
                                return user.value.id
                            });
                            var receivers = recieverIds.concat(recieverIds2);
                            updatePhotosUser(receivers, newPhoto, oldPhoto);
                        })
                        .fail(function (err) {
                            console.log(err.body.message)
                        })
                    if (result.body.prev === undefined) {
                        offset += config.pagination.limit
                        getUserReceivers(type, dbId, newPhoto, oldPhoto, offset)
                    }
                })
                .fail(function (err) {
                    console.log(err.body.message)
                })
        }
        getUserReceivers(type, dbId, newPhoto, oldPhoto, 0)
    }
}

var updatePhotosPath = function (recieverIds, dbId, newPhoto) {
    recieverIds.forEach(function (recieverId) {
        myFirebaseRef.child(recieverId + "/nof/").orderByChild("link").equalTo(dbId).on("child_added", function (snapshot) {
            var val = snapshot.val();
            if (val.title != 'New Course' && val.title != 'You have been mentioned!') {
                myFirebaseRef.child(recieverId + "/nof/" + snapshot.key()).update({"photo": newPhoto});
            }
        });
    })
}

var updatePhotosUser = function (recieverIds, newPhoto, oldPhoto) {
    recieverIds.forEach(function (recieverId) {
        myFirebaseRef.child(recieverId + "/nof/").orderByChild("photo").equalTo(oldPhoto).on("child_added", function (snapshot) {
            myFirebaseRef.child(recieverId + "/nof/" + snapshot.key()).update({"photo": newPhoto});
        });
    })
}

var getPathFromChannel = function () {

}

/**
 * iterates through the produced courses of a mentor and
 * see if any of them have the flag mentorAvailable = false
 * @param mentorId
 * @param callback
 */
var checkIfMentorAvailable = function (mentorId, callback) {
    var mentorAvailable = true
    /**
     * mentor will not have more than 100 courses.
     * hmmph. hence this is not recursive.
     */
    db.newGraphReader()
        .get()
        .limit(100)
        .offset(0)
        .from('users', mentorId)
        .related('produces')
        .then(function (result) {
            result.body.results.forEach(function (onePath) {
                if (!onePath.value.mentorAvailable)
                    mentorAvailable = false
            })
            callback(null, mentorAvailable)
        })
        .fail(function (err) {
            callback(null, mentorAvailable)
        })
}

module.exports = Notifications;
