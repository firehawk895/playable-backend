var config = require('./config.js');
var constants = require('./constants')

var crypto = require('crypto');
var randomString = require('random-string');

var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var qbchat = require('./qbchat.js');

var QB = require('quickblox');
QB.init(config.qb.appId, config.qb.authKey, config.qb.authSecret, false);

var fs = require('fs'),
    S3FS = require('s3fs'),
    s3fsImpl = new S3FS(config.s3.bucket, {
        accessKeyId: config.s3.access,
        secretAccessKey: config.s3.secret
    });

var Firebase = require("firebase");
var myFirebaseRef = new Firebase(config.firebase.url, config.firebase.secret);

var kew = require('kew')
var date = new Date()


/**
 * Orchestrate query wrappers ---------------------------------->
 */
/**
 * create an orchestrate Neo4J graph connection
 * @param from
 * @param fromKey
 * @param to
 * @param toKey
 * @param relationName
 */
function createGraphRelation(from, fromKey, to, toKey, relationName) {
    db.newGraphBuilder()
        .create()
        .from(from, fromKey)
        .related(relationName)
        .to(to, toKey);
}

function createGraphRelationPromise(from, fromKey, to, toKey, relationName) {
    return db.newGraphBuilder()
        .create()
        .from(from, fromKey)
        .related(relationName)
        .to(to, toKey);
}


/**
 *
 * @param collection
 * @param id
 * @param relation
 * @returns {GraphBuilder}
 */
function getGraphResultsPromise(collection, id, relation) {
    return db.newGraphReader()
        .get()
        .from(collection, id)
        .related(relation)
}

/**
 * Orchestrate query wrappers ENDS------------------------------>
 */
/**
 * LUCENE query generators ------------------------------------->
 */
/**
 * generete the lucene query for min and max skill rating
 *
 * Lucene reference:
 * Your queries can contain as many as ten different buckets in a single Range Aggregate.
 * Each bucket can have numerical min and max values, separated by a tilde character (~).
 * An asterisk may be used to designate a particular range bucket as boundless.
 * For example, the range *~-10 would mean "all values less than negative ten" and
 * the range 100~* would communicate "all values greater than or equal to one hundred".
 *
 * Ya that shit didn't work so I used the range [minRating TO 5] etc. -_- :*
 * @param minRating
 * @param maxRating
 */
function createSkillRatingQuery(minRating, maxRating) {
    var skillQuery = "value.skill_level_min:[" + minRating + " TO 5] AND " + "value.skill_level_max:[1 TO " + maxRating + "]"
    return skillQuery
}
/**
 * get results having playing_time that are past the current time
 * and whose results matches/events are discoverable
 * @returns {string}
 */
function createIsDiscoverableQuery() {
    var date = new Date()
    var currentUnixTime = Math.round(date.getTime() / 1000)
    var query = "value.playing_time: " + currentUnixTime + "~*"  //this means greater than equalto
    //https://orchestrate.io/docs/apiref#search
    //matches that are not discoverable for any reason are set to isDiscoverable: false
    query = query + " AND value.isDiscoverable:true"
    return query
}

/**
 * basic query to display users in the users discover section
 * the user should appear only when he has selected his interested sports
 * also, exclude the searching user itself from the results
 * @param userId
 * @returns {string}
 */
function createPlayerDiscoverableQuery(userId) {
    var query = "value.hasSelectedSports:true AND @path.key:* NOT " + userId
    return query
}

/**
 * get a promise of the user's connections
 * @param userId
 * @returns {GraphBuilder}
 */
function getUsersConnectionsPromise(userId) {
    return getGraphResultsPromise('users', userId, constants.graphRelations.users.connections)
}

/**
 *
 * @param userId
 */
function getUserPromise(userId) {
    return db.get('users', userId)
}

/**
 * generates a lucene OR query for a set of values (theArray)
 * for a specific key (searchKey) to search for
 * @param theArray
 * @param searchKey
 * @returns {string}
 */
function createFieldORQuery(theArray, searchKey) {
    var theQuery = searchKey + ": ("
    theArray.forEach(function (oneItem) {
        theQuery += "`" + oneItem + "` OR "
    })
    theQuery += ")"
    theQuery = theQuery.substring(0, theQuery.length - 4);
    return theQuery
}

/**
 * create a distance query for orchestrate
 * @param lat
 * @param long
 * @param radius
 * @returns {string}
 */
function createDistanceQuery(lat, long, radius) {
    var theDistanceQuery = "value.location:NEAR:{lat:" + parseFloat(lat) + " lon:" + parseFloat(long) + " dist:" + radius + "}";
    return theDistanceQuery
}

/**
 * create a eventId search query
 * @param eventId
 */
function createSearchByIdQuery(id) {
    var searchByIdQuery = "@path.key:" + id + ""
    return searchByIdQuery
}

/**
 * Note : For lucene you can use filed grouping:
 * Field Grouping
 * Lucene supports using parentheses to group multiple clauses to a single field.
 * To search for a title that contains both the word "return" and the phrase "pink panther" use the query:
 * title:(+return +"pink panther")
 *
 * createSportsQuery can be updated this way
 */

/**
 * Crate a lucene OR query with the array of sports provided
 * @param sportsArray
 * @returns {string}
 */
function createSportsQuery(sportsArray) {
    return createFieldORQuery(sportsArray, "value.sports")
}

/**
 * join a set of queries with AND, OR conditions
 * for lucene/orchestrate
 * @param queries
 * @param type
 */
function queryJoiner(queries) {
    var returnQuery = ""
    queries.forEach(function (query) {
        returnQuery += "("
        returnQuery += query
        returnQuery += ") AND "
    })
    returnQuery = returnQuery.substring(0, returnQuery.length - 5)
    return returnQuery
}
/**
 *
 * LUCENE query generators ENDS---------------------------------->
 */


/**
 * Uploads file to S3
 * @param {file} file
 * @param {function} callback
 */
function upload(file, callback) {
    if (file != undefined) {
        var stream = fs.createReadStream(file.path);
        var randomString = generateToken(3)
        var originalname = file.originalname.replace(/[^\w.]/g, '_')
        var extension = originalname.match(/(\.[^.]+$)/)[0]
        var fileNameOnly = originalname.replace(/(\.[^.]+$)/, '')
        var filename = fileNameOnly + '_' + randomString + extension
        var thumb_filename = fileNameOnly + '_' + randomString + '.png'
        s3fsImpl.writeFile(filename, stream).then(function (data) {
            fs.unlink(file.path, function (err) {
                if (err) {
                    callback(err);
                }
                var info = {
                    url: "https://s3.amazonaws.com/" + config.s3.bucket + "/" + filename,
                    urlThumb: "https://s3.amazonaws.com/" + config.s3.bucket + "resized/resized-" + thumb_filename
                }
                callback(info);
            });
        });
    } else {
        callback(undefined);
    }

}

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


/**
 * Generate an access token for login
 * refer http://stackoverflow.com/questions/8855687/secure-random-token-in-node-js
 * can update to base64 if needed
 * @returns {string|*} access token
 */
function generateToken(length) {
    if (length)
        return crypto.randomBytes(length).toString('hex');
    else
        return crypto.randomBytes(16).toString('hex');
}

/**
 * Returns a random whole number between min (inclusive) and max (exclusive)
 * @param min
 * @param max
 * @returns {number}
 */
function getRandomArbitrary(min, max) {
    return (Math.random() * (max - min) + min) | 0;
}


/**
 * Generate unique key
 * @returns {string|*} key
 */
function randomizer() {
    return randomString({
        length: 16,
        numeric: true,
        letters: true,
        special: false
    });
}


function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function stringToBoolean(theString) {
    if (theString == "true") {
        return true;
    } else {
        return false;
    }
}

/**
 * Crate a lucene OR query with the array of gender provided
 * @param genderArray
 * @returns {*}
 */
function createGenderQuery(genderArray) {
    return createFieldORQuery(genderArray, "value.gender")
}

/**
 * check if a user is participating in a match
 * @param matchId
 * @param userId
 * @returns {SearchBuilder}
 */
function checkMatchParticipationPromise(matchId, userId) {
    var checkMatchParticipation =
        db.newSearchBuilder()
            .query(createGetOneOnOneGraphRelationQuery('matches', matchId, 'participants', 'users', userId))
    return checkMatchParticipation
}

function checkEventParticipationPromise(eventId, userId) {
    var checkEventParticipationPromise =
        db.newSearchBuilder()
            .query(createGetOneOnOneGraphRelationQuery('events', eventId, 'participants', 'users', userId))
    return checkEventParticipationPromise
}


/**
 * get featured matches
 * @returns {SearchBuilder} promise
 */
function getFeaturedEventsPromise() {
    var queries = new Array()
    queries.push("value.isFeatured:true")
    queries.push(createIsDiscoverableQuery())
    var finalQuery = queryJoiner(queries)
    var featuredMatches = db.newSearchBuilder()
        .collection("events")
        .query(finalQuery)

    return featuredMatches
}

function incrementMatchesPlayed(userId) {
    db.get("users", userId)
        .then(function (result) {
            var matchesPlayed = result.body.matchesPlayed;
            db.merge("users", userId, {
                matchesPlayed: matchesPlayed + 1
            })
        })
}

/**
 * Inserts the id into every response object
 * extracted from orchestrate's "path" key
 * @param results
 * @returns {Array}
 */
function injectId(results) {
    var response = results.body.results.map(function (aResult) {
        var value = aResult.value
        value["id"] = aResult.path.key
        return value
    })
    return response
}

/**
 * inject the distance between the match and the user in km
 * @param results orchestrate response of matches
 * @param usersLat lat coordinates of the user
 * @param usersLong long coordinates of the user
 */
var insertDistance = function (results, usersLat, usersLong) {
    var newResults = results.body.results.map(function (aResult) {
        aResult["value"]["distance"] = getDistanceFromLatLonInKm(
            aResult["value"]["location"]["lat"],
            aResult["value"]["location"]["long"],
            usersLat,
            usersLong
        )
        return aResult;
        //console.log(aResult["value"]["distance"])
    })
    console.log(newResults)
    results.body.results = newResults
    return results
}

/**
 * calculate direct distance between two coordinates
 * Note: we are using direct distance not motorable distance
 * http://stackoverflow.com/questions/18883601/function-to-calculate-distance-between-two-coordinates-shows-wrong
 * @param lat1
 * @param lon1
 * @param lat2
 * @param lon2
 * @returns {number}
 */
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}


/**
 * update the connections of all users when a new player
 * joins the match
 * @param userId
 * @param matchId
 */
function updateMatchConnections(userId, matchId) {
    /**
     * get all the players of the match
     * let playerList = the players of the match except the player in userId
     * create connections of userId to the playerList if no existing connection exists
     * create connections of each player in playerList to the userId if no existing connection exists
     */
    db.newGraphReader()
        .get()
        .from('matches', matchId)
        .related('participants')
        .then(function (results) {
            //get all the players of the match
            var playerList = results.body.results.map(function (oneUser) {
                return oneUser.path.key;
            })

            //let players = the players of the match except the player in userId
            var index = playerList.indexOf(userId)
            if (index > -1) {
                playerList.splice(index, 1);
            }

            playerList.forEach(function (playerId) {
                createGraphRelation('users', userId, 'users', playerId, 'connections')
                createGraphRelation('users', playerId, 'users', userId, 'connections')
            })
        })
}

/**
 * create a connection between two users
 * who have accepted each others request
 * @param user1id
 * @param user2id
 */
function createConnection(user1id, user2id) {
    createGraphRelation('users', user1id, 'users', user2id, 'connections')
    createGraphRelation('users', user2id, 'users', user1id, 'connections')

    kew.all([getUserPromise(user1id), getUserPromise(user2id)])
        .then(function (results) {
            var user1QBid = results[0].qbId
            var user2QBid = results[1].qbId

            qbchat.createRoom(2, constants.chats.oneOnOne + ":::" + user1id + ":::" + user2id, function (err, newRoom) {
                if (err) {
                    console.log("error creating the one on one room")
                    console.log(err);
                }
                else {
                    qbchat.addUserToRoom(newRoom._id, [user1QBid, user2QBid], function (err, result) {
                        if (err) console.log(err);
                    })
                }
            })
        })
}

/**
 * create a connection request from user1 to user2
 * @param user1id
 * @param user2id
 * @returns {*}
 */
function createConnectionRequest(user1id, user2id, user1name, user1photo) {
    createConnectionRequestInvite(user1id, user2id, user1name, user1photo)
    return kew.all([
        createGraphRelationPromise('users', user1id, 'users', user2id, constants.graphRelations.users.requestedToConnect),
        createGraphRelationPromise('users', user2id, 'users', user1id, constants.graphRelations.users.waitingToAccept)
    ])
}

/**
 * the connection request sent from user1 to user2 is now
 * accepted by user2
 * refer : createConnectionRequest
 * user2 accepts user1
 * @param user1id
 * @param user2id
 */
function acceptConnectionRequest(user1id, user2id) {
    deleteGraphRelation('users', user1id, 'users', user2id, constants.graphRelations.users.waitingToAccept)
    deleteGraphRelation('users', user2id, 'users', user1id, constants.graphRelations.users.requestedToConnect)
    createConnection(user1id, user2id)
}

/**
 * 'fix a match' request user1 to user2
 * @param user1id
 * @param user2id
 */
function createMatchRequest(user1id, user2id, matchPayload, user1name) {
    console.log("createMatchRequest")
    createMatchRequestInvite(user1id, user2id, matchPayload, user1name)
    return kew.all([
        createGraphRelationPromise('users', user1id, 'users', user2id, constants.graphRelations.users.requestedToConnect),
        createGraphRelationPromise('users', user2id, 'users', user1id, constants.graphRelations.users.waitingToAccept)
    ])
}

/**
 * the 'fix a match' request sent from user1 to user2 is now
 * accepted by user2
 * refer : createMatchRequest
 * user2 accepts user1's match request
 * @param user1id
 * @param user2id
 */
function acceptMatchRequest(user1id, user2id, matchPayload) {
    deleteGraphRelation('users', user1id, 'users', user2id, constants.graphRelations.users.requestedToConnect)
    deleteGraphRelation('users', user2id, 'users', user1id, constants.graphRelations.users.waitingToAccept)
    createConnection(user1id, user2id)
    function createOneOnOneFixAmatch(user1id, matchPayload) {
        db.post('matches', matchPayload)
            .then(function (result) {
                matchPayload["id"] = result.headers.location.match(/[0-9a-z]{16}/)[0];
                if (matchPayload.isFacility) {
                    connectFacilityToMatch(matchPayload["id"], matchPayload["facilityId"])
                }
                /**
                 * The numerous graph relations are so that we
                 * can access the related data from any entry point
                 */
                    //The user hosts the match
                createGraphRelation('users', user1id, 'matches', matchPayload["id"], constants.graphRelations.users.hostsMatch)
                //The user plays in the match
                createGraphRelation('users', user1id, 'matches', matchPayload["id"], constants.graphRelations.users.playsMatches)
                //The match is hosted by user
                createGraphRelation('matches', matchPayload["id"], 'users', user1id, constants.graphRelations.matches.isHostedByUser)
                //The match has participants (user)
                createGraphRelation('matches', matchPayload["id"], 'users', user1id, constants.graphRelations.matches.participants)

                createChatRoomForMatch(user1id, matchPayload["id"])
                notifyMatchCreated(matchPayload["id"], matchPayload["playing_time"])
            })
    }

    createOneOnOneFixAmatch(user1id, matchPayload)
}

/**
 * create the chat room for a match
 * @param hostUserQbId
 * @param matchId
 */
function createChatRoomForMatch(hostUserQbId, matchId) {
    /**
     * format of match dialog title:
     * <matchRoom>:::matchId
     * format of user dialog title:
     * <connectionRoom>:::user1id:::user2Id
     */
    qbchat.createRoom(2, constants.chats.matchRoom + ":::" + matchId, function (err, newRoom) {
        if (err) {
            console.log("error creating the room")
            console.log(err);
        }
        else {
            console.log("bro add ho gaya bro")
            console.log(hostUserQbId)
            qbchat.addUserToRoom(newRoom._id, [hostUserQbId], function (err, result) {
                if (err) {
                    console.log("error making the dude join the room")
                    console.log(err);
                } else {
                    console.log("bro add ho gaya bro")
                    db.merge('matches', matchId, {"qbId": newRoom._id})
                        .then(function (result) {
                            //chatObj["id"] = date.getTime() + "@1";
                            //chatObj["channelName"] = payload["title"];
                            //chatObj["channelId"] = newRoom._id;
                            //notify.emit('wordForChat', chatObj);
                        })
                        .fail(function (err) {
                            console.log(err.body.message);
                        });
                }
            })
        }
    });
}

function getConnectionStatusPromise(user1id, user2id) {
    var connectionStatus = kew.defer()
    kew.all([checkIfConnected(user1id, user2id), checkIfRequestedToConnect(user1id, user2id), checkIfWaitingToAccept(user1id, user2id)])
        .then(function (results) {
            if (results[0])
                connectionStatus = connectionStatus.resolve(constants.connections.status.connected)
            else if (results[1])
                connectionStatus = connectionStatus.resolve(constants.connections.status.requestedToConnect)
            else if (results[2])
                connectionStatus = connectionStatus.resolve(constants.connections.status.waitingToAccept)
            else
                connectionStatus = connectionStatus.resolve(constants.connections.status.none)
        })
    return connectionStatus
}


function checkIfRequestedToConnect(user1id, user2id) {
    var thePromise = kew.defer()
    var query = createGetOneOnOneGraphRelationQuery('users', user1id, 'requestedToConnect', 'users', user2id)
    db.newSearchBuilder()
        .collection('users')
        .query(query)
        .then(function (result) {
            if (result.body.count == 1) {
                thePromise.resolve(true)
            } else {
                thePromise.resolve(false)
            }
        })
        .fail(function (err) {
            thePromise.reject(err)
        })
    return thePromise
}

function checkIfWaitingToAccept(user1id, user2id) {
    var thePromise = kew.defer()
    var query = createGetOneOnOneGraphRelationQuery('users', user1id, 'waitingToAccept', 'users', user2id)
    db.newSearchBuilder()
        .collection('users')
        .query(query)
        .then(function (result) {
            if (result.body.count == 1) {
                thePromise.resolve(true)
            } else {
                thePromise.resolve(false)
            }
        })
        .fail(function (err) {
            thePromise.reject(err)
        })
    return thePromise
}

function checkIfConnected(user1id, user2id) {
    var thePromise = kew.defer()
    var query = createGetOneOnOneGraphRelationQuery('users', user1id, 'waitingToAccept', 'users', user2id)
    db.newSearchBuilder()
        .collection('users')
        .query(query)
        .then(function (result) {
            if (result.body.count == 1) {
                thePromise.resolve(true)
            } else {
                thePromise.resolve(false)
            }
        })
        .fail(function (err) {
            thePromise.reject(err)
        })
    return thePromise
}

/**
 * Create the invite when a 1 on 1 connect request is sent
 * @param user1id
 * @param user2id
 */
function createConnectionRequestInvite(user1id, user2id, user1name, user1photo) {
    var payload = {
        fromUserId: user1id,
        toUserId: user2id,
        type: constants.requests.type.connect,
        status: constants.requests.status.pending,
        msg: user1name + " has requested to connect with you",
        photo: user1photo,
        timestamp: date.getTime()
    }
    pushRequestToFirebase(payload, user2id)
}

/**

 * @param user1id
 * @param user2id
 */

/**
 * Create the invite when a 'fix a match' request is sent
 * pretty much like 1 on 1 connect request, with the extra match
 * @param user1id the requester
 * @param user2id the invitee
 * @param matchPayload the match to be created
 */
function createMatchRequestInvite(user1id, user2id, matchPayload, user1name) {
    var payload = {
        fromUserId: user1id,
        toUserId: user2id,
        type: constants.requests.type.match,
        status: constants.requests.status.pending,
        photo: "",
        msg: user1name + " wants to play a game of " + matchPayload.sport + " with you",
        match: matchPayload,
        timestamp: date.getTime()
    }
    pushRequestToFirebase(payload, user2id)
}

function createInviteToMatchRequest(fromUserId, fromUserName, matchId, matchTitle, sportName, toUserId) {
    var payload = {
        fromUserId: fromUserId,
        msg: "You have been invited to play a game of " + sportName + " by " + fromUserName + "in the match " + matchTitle,
        toUserId: toUserId,
        matchId: matchId,
        type: constants.requests.type.invite,
        timestamp: date.getTime()
    }
    pushRequestToFirebase(payload, toUserId)
}

/**
 * Delete a graph relation from orchestrate
 * @param from
 * @param fromKey
 * @param to
 * @param toKey
 * @param relationName
 */
function deleteGraphRelation(from, fromKey, to, toKey, relationName) {
    db.newGraphBuilder()
        .remove()
        .from(from, fromKey)
        .related(relationName)
        .to(to, toKey);
}

function sendErrors(errorArray, statusCode, res) {
    /**
     * include validations if required
     * TODO: convert this to a mapped array of key : error
     * That seems to be a more standard way of doing it these days
     */
    var responseObj = {}
    responseObj["errors"] = errorArray;
    res.status(statusCode);
    res.json(responseObj);
}

/**
 * generate a one on one graph relation query
 * @param sourceCollection
 * @param sourceId
 * @param destinationCollection
 * @param destinationId
 */
function createGetOneOnOneGraphRelationQuery(sourceCollection, sourceId, relation, destinationCollection, destinationId) {
    var query =
        "@path.kind:relationship AND @path.source.collection:`" +
        sourceCollection +
        "` AND @path.source.key:`" +
        sourceId + "` AND @path.relation:`" +
        relation + "` AND @path.destination.collection:`" +
        destinationCollection + "` AND @path.destination.key:`" +
        destinationId + "`"
    return query
}

/**
 *
 * @param userId
 * @returns {number|*|!Promise}
 */
function getTotalConnections(userId) {
    var totalConnectionsDefer = kew.defer()
    getGraphResultsPromise("users", userId, "connections")
        .then(function (result) {
            kew.resolve(result.body.count)
        })
        .fail(function (err) {
            kew.reject(err)
        })
    return totalConnectionsDefer
}

/**
 * takes a json payload and inserts flags:
 * hasMale, hasFemale, hasCustomGender
 * @param payload
 * @param gender
 * @returns {*}
 */
function updateGenderInPayload(payload, gender) {
    if (gender == "male")
        payload["hasMale"] = true
    else if (gender == "female")
        payload["hasFemale"] = true
    else {
        payload["hasCustomGender"] = true
    }
    return payload
}

/**
 * creates cron jobs that will create recommendations
 * for the participants of the match
 * @param matchId
 * @param playing_time
 */
function createRecommendationCron(matchId, playing_time) {
    //create new cron for the playing_time + constants.recommendation.dispatchTime
    //get all match participants
    //create recommendation objects for each user in firebase
    var matchPromise = getMatchPromise(matchId)
    var participantsPromise = getMatchParticipantsPromise(matchId)

    kew.all([matchPromise, participantsPromise])
        .then(function (results) {
            var match = results[0]
            var participants = results[1]
            if (match.body.slots_filled == 2) {
                //1 on 1 match
                var participant1 = participants.results.body[0];
                var participant2 = participants.results.body[1];
                createRateYourOpponentReco(participant1.key, participant2.key, participant2.value.name)
                createRateYourOpponentReco(participant2.key, participant1.key, participant1.value.name)
            } else {
                //team match (more than 2 players)
                participants.results.body.forEach(function (participant) {
                    createRateTeamReco(participant.key, matchId, match.title)
                })
            }
            if (match.isFacility) {
                getFacilityOfMatchPromise
                    .then(function (result) {
                        var facilityId = result.body.results[0].path.key
                        var facility = result.body.results[0].path.value
                        participants.results.body.forEach(function (participant) {
                            createRateFacilityReco(participant.key, facilityId, facility)
                        })
                    })
            }
        })
}

function createRateYourOpponentReco(fromUserId, toUserId, toUserName) {
    var payload = {
        'type': constants.recommendations.type.OneOnOne, //the type of Recommendation rating
        'message': 'Rate your opponent! Would you like to play with ' + toUserName + " again?",
        'isRated': false, //set to true once user has rated this
        'rating': constants.recommendations.rating.notPlayed, //front End will switch this to "thumbsUp" or "thumbsDown",
        fromUserId: fromUserId,
        'toUserId': toUserId
    }
    pushRecoToFirebase(payload, fromUserId)
}

function parseOneOnOneReco(recoObj) {
    rateUser(recoObj.rating, recoObj.toUserId)
    incrementMatchesPlayed(recoObj.fromUserId)
}

function createRateFacilityReco(fromUserId, toFacilityId, facilityName) {
    var payload = {
        'type': constants.recommendations.type.facility, //the type of Recommendation rating
        'message': 'How would you like to rate the facility ' + facilityName + "?",
        'isRated': false, //set to true once user has rated this
        'rating': constants.recommendations.rating.notPlayed, //front End will switch this to "thumbsUp" or "thumbsDown" or "notPlayed",
        fromUserId: fromUserId,
        toFacilityId: toFacilityId
    }
    pushRecoToFirebase(payload, fromUserId)
}

function parseFacilityReco(recoObj) {
    rateFacility(recoObj.rating, recoObj.toFacilityId)
}

function createRateTeamReco(fromUserId, toMatchId, toMatchName) {
    var payload = {
        'type': constants.recommendations.type.team, //the type of Recommendation rating
        'message': 'Rate the match "' + toMatchName + '"! Would you play with this team again?',
        'isRated': false, //set to true once user has rated this
        'rating': constants.recommendations.rating.notPlayed, //front End will switch this to "thumbsUp" or "thumbsDown" or "notPlayed",
        'toMatchId': toMatchId,
        'fromUserId': fromUserId
    }
    pushRecoToFirebase(payload, fromUserId)
}

function parseTeamReco(recoObj) {
    getMatchParticipantsPromise(recoObj.toMatchId)
        .then(function (results) {
            var participantIds = results.body.results.map(function (aResult) {
                return aResult.path.key
            })

            //If you've rated, you've played
            //because, you know, users are honest :)
            if (recoObj.rating != constants.recommendations.rating.notPlayed) {
                incrementMatchesPlayed(recoObj.fromUserId)
            }
            participantIds.splice(recoObj.fromUserId, 1)
            participantIds.forEach(function (participantId) {
                rateUser(recoObj.rating, participantId)
            })
        })
}

/**
 * Parse each recommendation marked by user
 * and do the needful updates
 * @param recoObj
 */
function parseRecObject(recoObj) {
    switch (recoObj.type) {
        case constants.recommendations.type.OneOnOne:
            parseOneOnOneReco(recoObj)
            break;
        case constants.recommendations.type.facility:
            parseFacilityReco(recoObj)
            break;
        case constants.recommendations.type.team:
            parseTeamReco(recoObj)
            break;
        default:
    }
}

/**
 * Listened to a "accepted" request event
 * Now do the needful for each type of request
 * @param requestObj
 */
function parseRequestObject(requestObj) {
    switch (requestObj.type) {
        case constants.requests.type.connect:
            parseConnectRequest(requestObj)
            break;
        case constants.requests.type.match:
            parseMatchRequest(requestObj)
            break;
        default:
    }
}

function parseConnectRequest(requestObj) {
    acceptConnectionRequest(requestObj.toUserId, requestObj.fromUserId)
}

/**
 * refer to createMatchRequestInvite for the format of requestObj
 * @param requestObj
 */
function parseMatchRequest(requestObj) {
    acceptMatchRequest(requestObj.fromUserId, requestObj.toUserId, requestObj.match)
    //make them a connection
    //is the create match reusable?
    //create a match with the specified stuff
    //make them join the match

    function createThatFixAmatchKaMatch() {

    }
}

function rateUser(rating, userId) {
    var payload = {}
    db.get('users', userId)
        .then(function (result) {
            var totalRatings = result.body.totalRatings
            var thumbsUps = result.body.thumbsUps
            var matchesPlayed = result.body.matchesPlayed

            if (rating == constants.recommendations.rating.thumbsUp) {
                payload = {
                    totalRatings: totalRatings + 1,
                    thumbsUps: thumbsUps + 1
                }
            } else if (rating == constants.recommendations.rating.thumbsDown) {
                payload = {
                    totalRatings: totalRatings + 1
                }
            }
            db.merge('users', userId, payload)
        })
}

function rateFacility(rating, facilityId) {
    var payload = {}
    getFacilityPromise(facilityId)
        .then(function (result) {
            var totalRatings = result.body.totalRatings
            var thumbsUps = result.body.thumbsUps
            var matchesPlayed = result.body.matchesPlayed

            if (rating == constants.recommendations.rating.thumbsUp) {
                payload = {
                    totalRatings: totalRatings + 1,
                    thumbsUps: thumbsUps + 1
                }
            } else if (rating == constants.recommendations.rating.thumbsDown) {
                payload = {
                    totalRatings: totalRatings + 1
                }
            }
            db.merge('facilities', facilityId, payload)
        })
}


/**
 * Push a recommendation to Firebase user tree
 * @param jsonPayload
 * @param userId
 */
function pushRecoToFirebase(jsonPayload, userId) {
    var newRecoRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.recommendations + "/" + userId)
    newRecoRef.child("data").push().set(jsonPayload)
    newRecoRef.child("count").transaction(function (current_value) {
        return (current_value || 0) + 1;
    });
}

/**
 * Push a request to Firebase user tree
 * @param jsonPayload
 * @param userId
 */
function pushRequestToFirebase(jsonPayload, userId) {
    var newRequestRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.requests + "/" + userId)
    newRequestRef.child("data").push().set(jsonPayload)
    newRequestRef.child("count").transaction(function (current_value) {
        return (current_value || 0) + 1;
    });
}

function getFacilityOfMatchPromise(matchId) {
    return getGraphResultsPromise('matches', matchId, constants.graphRelations.matches.hostedFacility)
}

function getMatchPromise(matchId) {
    return db.get('matches', matchId)
}

function getFacilityPromise(facilityId) {
    return db.get('facilities', facilityId)
}

/**
 * get the promise that gets the participants of the matches
 * @param matchId
 */
function getMatchParticipantsPromise(matchId) {
    return getGraphResultsPromise('matches', matchId, 'participants')
}

function getMatchHistoryPromise(userId) {
    return getGraphResultsPromise('users', userId, 'plays')
}


function createRecoForFacility(facilityId) {
    var payload = {}
}

function createRecoForGroupMatch(matchId) {

}

function removeFromMatch(userId, matchId) {
    return kew.all([
        deleteGraphRelation('matches', matchId, 'users', userId, constants.graphRelations.matches.participants),
        deleteGraphRelation('users', userId, 'matches', matchId, constants.graphRelations.users.playsMatches)
    ])
}

function connectFacilityToMatch(matchId, facilityId) {
    createGraphRelation('matches', matchId, 'facilities', facilityId, constants.graphRelations.matches.hostedFacility)
    createGraphRelation('facilities', facilityId, 'matches', matchId, constants.graphRelations.matches.hasMatches)
}

/**
 * if the time is within the last 1 minute
 * this is the definition of recent as far as this method
 * is concerned
 * @param timestamp
 * @returns {boolean}
 */
function isRecent(timestamp) {
    if (timestamp > ((date.getTime() / 1000) - 60))
        return true
    else
        return false
}

/**
 *
 * @param userIdList
 * @returns {!Promise}
 */
function getGcmIdsForUserIds(userIdList) {
    var gcmUserIds = kew.defer();
    var queries = []
    userIdList.forEach(function (userId) {
        queries.push(createSearchByIdQuery(userId))
    })

    var theFinalQuery = queryJoiner(queries)

    db.newSearchBuilder()
        .collection("users")
        //.sort('location', 'distance:asc')
        .query(theFinalQuery)
        .then(function (result) {
            var gcmUserIds = result.body.results.map(function (user) {
                return user.value.gcmId
            });
            kew.resolve(gcmUserIds)
        })
        .fail(function (err) {
            kew.reject(err)
        })

    return gcmUserIds
}

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

/**
 * Time capsule:
 * ----------------------------------------------
 * 11:37 Pm, 27th Jan 2016, Malviya Nagar.
 * listening to https://youtu.be/ysx9BVYlUY4
 * Surreal music. It's quiet, I'm alone. My best friend will be
 * coming to visit me. Sia - Breathe Me
 *
 * <Hey developer :), add your location and what you're doing here>,
 * leave memories behind, because tu beer hai bc :)
 */

exports.upload = upload;
exports.generateToken = generateToken;
exports.randomizer = randomizer;
exports.toTitleCase = toTitleCase;
exports.stringToBoolean = stringToBoolean;
exports.getRandomArbitrary = getRandomArbitrary;

exports.queryJoiner = queryJoiner;
exports.createDistanceQuery = createDistanceQuery;
exports.createSportsQuery = createSportsQuery;
exports.createSkillRatingQuery = createSkillRatingQuery;
exports.injectId = injectId;
exports.insertDistance = insertDistance;
exports.createSearchByIdQuery = createSearchByIdQuery;
exports.createIsDiscoverableQuery = createIsDiscoverableQuery;

//matches/events
exports.updateMatchConnections = updateMatchConnections;
exports.updateGenderInPayload = updateGenderInPayload;
exports.createGenderQuery = createGenderQuery;
exports.createConnection = createConnection;
exports.getFeaturedEventsPromise = getFeaturedEventsPromise;
exports.incrementMatchesPlayed = incrementMatchesPlayed;
exports.getTotalConnections = getTotalConnections;
exports.removeFromMatch = removeFromMatch;
exports.connectFacilityToMatch = connectFacilityToMatch;
exports.createMatchRequest = createMatchRequest;
exports.createChatRoomForMatch = createChatRoomForMatch;
exports.checkEventParticipationPromise = checkEventParticipationPromise;

//players
exports.createPlayerDiscoverableQuery = createPlayerDiscoverableQuery;
exports.getUsersConnectionsPromise = getUsersConnectionsPromise;
exports.getConnectionStatusPromise = getConnectionStatusPromise;

//db
exports.createGraphRelation = createGraphRelation;
exports.deleteGraphRelation = deleteGraphRelation;
exports.sendErrors = sendErrors;

exports.parseRecObject = parseRecObject;
exports.createRecommendationCron = createRecommendationCron;
exports.getMatchParticipantsPromise = getMatchParticipantsPromise;
exports.checkMatchParticipationPromise = checkMatchParticipationPromise;
exports.getMatchHistoryPromise = getMatchHistoryPromise;

//chat
exports.getUsersDialogs = getUsersDialogs
exports.isRecent = isRecent

//requests
exports.createConnectionRequest = createConnectionRequest;
exports.acceptConnectionRequest = acceptConnectionRequest;
//exports.checkIfRequestedToConnect = checkIfRequestedToConnect;
//exports.checkIfWaitingToAccept = checkIfWaitingToAccept;
//exports.checkIfConnected = checkIfConnected;
exports.parseRequestObject = parseRequestObject;
exports.createInviteToMatchRequest = createInviteToMatchRequest;
//exports.parseConnectRequest = parseConnectRequest;

//firebase
exports.dispatchEvent = dispatchEvent

//gcm Id
exports.getGcmIdsForUserIds = getGcmIdsForUserIds