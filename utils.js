var config = require('./config.js');

var crypto = require('crypto');
var randomString = require('random-string');

var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var fs = require('fs'),
    S3FS = require('s3fs'),
    s3fsImpl = new S3FS(config.s3.bucket, {
        accessKeyId: config.s3.access,
        secretAccessKey: config.s3.secret
    });

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
    var searchByIdQuery = "path.key: `" + id + "`"
    return searchByIdQuery
}

/**
 * Crate a lucene query with the array of sports provided
 * @param sportsArray
 * @returns {string}
 */
function createSportsQuery(sportsArray) {
    var theSportsQuery = ""
    sportsArray.forEach(function (sport) {
        theSportsQuery = theSportsQuery + "value.sport:`" + sport + "` OR "
    })
    theSportsQuery = theSportsQuery.substring(0, theSportsQuery.length - 4);
    return theSportsQuery
}

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
 * @param minRating
 * @param maxRating
 */
function createSkillRatingQuery(minRating, maxRating) {
    var skillQuery = "value.skill_level_min:" + minRating + "~* AND " + "value.skill_level_max:*~" + maxRating
    return skillQuery
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
            var playerList = result.body.results.map(function (oneUser) {
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
}

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

/**
 * Create a request
 * @param type
 * @param userId
 * @param matchId
 */
function createRequest(type, userId, matchId, hostUserId) {
    switch (type) {
        case "invitedToMatch":
            ;
            ;
            break;
    }
}

function sendErrors(errorArray, statusCode) {
    /**
     * include validations if required
     * TODO: convert this to a mapped array of key : error
     * That seems to be a more standard way of doing it these days
     */
    var responseObj = []
    responseObj["errors"] = errorArray;
    res.status(statusCode);
    res.json(responseObj);
}

/**
 * Time capsule:
 * ----------------------------------------------
 * 11:37 Pm, 27th Jan 2016, Malviya Nagar.
 * listening to https://youtu.be/ysx9BVYlUY4
 * Surreal music. It's quite, I'm alone. My best friend will be
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
exports.queryJoiner = queryJoiner;
exports.createDistanceQuery = createDistanceQuery;
exports.createSportsQuery = createSportsQuery;
exports.createSkillRatingQuery = createSkillRatingQuery;
exports.injectId = injectId;
exports.insertDistance = insertDistance;
exports.getRandomArbitrary = getRandomArbitrary;
exports.updateMatchConnections = updateMatchConnections;
exports.createConnection = createConnection;
exports.createGraphRelation = createGraphRelation;
exports.deleteGraphRelation = deleteGraphRelation;
exports.createRequest = createRequest;
exports.sendErrors = sendErrors;
exports.createSearchByIdQuery = createSearchByIdQuery;
