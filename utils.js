var config = require('./config.js');
var constants = require('./constants')

var crypto = require('crypto');
var randomString = require('random-string');

var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var qbchat = require('./Chat/qbchat.js');

var QB = require('quickblox');
QB.init(config.qb.appId, config.qb.authKey, config.qb.authSecret, false);

var fs = require('fs'),
    S3FS = require('s3fs'),
    s3fsImpl = new S3FS(config.s3.bucket, {
        accessKeyId: config.s3.access,
        secretAccessKey: config.s3.secret
    });

var msg91 = require("msg91")(config.msg91.authkey, config.msg91.senderId, config.msg91.routeNumber);

var Firebase = require("firebase");
var myFirebaseRef = new Firebase(config.firebase.url, config.firebase.secret);

var kew = require('kew')
var date = new Date()

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


function createRecoForFacility(facilityId) {
    var payload = {}
}

function createRecoForGroupMatch(matchId) {

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

function sendSms(message, phoneNumber) {
    var sentStatus = kew.defer()
    msg91.send(phoneNumber, message, function (err, response) {
        if (err) {
            sentStatus.reject(err)
        } else {
            sentStatus.resolve(response)
        }
    });
    return sentStatus
}

/**
 * remove the elements of the subarray from the array
 * check efficiency here : http://jsperf.com/splice-vs-pack/11
 * cited in some stackoverflow answer
 * @param mainArray
 * @param subArray
 * @returns {Array}
 */
function removeSubArray(mainArray, subArray) {
    var removedSubarray = mainArray.filter(function (mainArrayItem) {
        if (subArray.indexOf(mainArrayItem) > -1)
            return false
        else
            return true
    })
    return removedSubarray
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
exports.removeSubArray = removeSubArray;
exports.getDistanceFromLatLonInKm = getDistanceFromLatLonInKm;
exports.sendErrors = sendErrors;
exports.isRecent = isRecent

//exports.queryJoiner = queryJoiner;
//exports.createDistanceQuery = createDistanceQuery;
//exports.createSportsQuery = createSportsQuery;
//exports.createSkillRatingQuery = createSkillRatingQuery;
//exports.injectId = injectId;
//exports.insertDistance = insertDistance;
//exports.createSearchByIdQuery = createSearchByIdQuery;
//exports.createIsDiscoverableQuery = createIsDiscoverableQuery;
//exports.createOnlyFutureTypeQuery = createOnlyFutureTypeQuery;

//matches/events
//exports.updateMatchConnections = updateMatchConnections;
//exports.updateGenderInPayload = updateGenderInPayload;
//exports.createGenderQuery = createGenderQuery;
//exports.createConnection = createConnection;
//exports.getFeaturedEventsPromise = getFeaturedEventsPromise;
//exports.incrementMatchesPlayed = incrementMatchesPlayed;
//exports.getTotalConnections = getTotalConnections;
//exports.removeFromMatch = removeFromMatch;
//exports.connectFacilityToMatch = connectFacilityToMatch;
//exports.createMatchRequest = createMatchRequest;
//exports.createChatRoomForMatch = createChatRoomForMatch;
//exports.checkEventParticipationPromise = checkEventParticipationPromise;

//players
//exports.createPlayerDiscoverableQuery = createPlayerDiscoverableQuery;
//exports.getUsersConnectionsPromise = getUsersConnectionsPromise;
//exports.getConnectionStatusPromise = getConnectionStatusPromise;

//db
//exports.createGraphRelation = createGraphRelation;
//exports.deleteGraphRelation = deleteGraphRelation;
//exports.createGraphRelationPromise = createGraphRelationPromise;

//exports.parseRecObject = parseRecObject;
//exports.createRecommendationCron = createRecommendationCron;
//exports.getMatchParticipantsPromise = getMatchParticipantsPromise;
//exports.checkMatchParticipationPromise = checkMatchParticipationPromise;
//exports.getMatchHistoryPromise = getMatchHistoryPromise;

//chat
//exports.getUsersDialogs = getUsersDialogs

//requests
//exports.createConnectionRequest = createConnectionRequest;
//exports.acceptConnectionRequest = acceptConnectionRequest;
//exports.checkIfRequestedToConnect = checkIfRequestedToConnect;
//exports.checkIfWaitingToAccept = checkIfWaitingToAccept;
//exports.checkIfConnected = checkIfConnected;
//exports.parseRequestObject = parseRequestObject;
//exports.createInviteToMatchRequest = createInviteToMatchRequest;
//exports.parseConnectRequest = parseConnectRequest;

//firebase
//exports.dispatchEvent = dispatchEvent

//gcm Id
//exports.getGcmIdsForUserIds = getGcmIdsForUserIds

//sms
exports.sendSms = sendSms