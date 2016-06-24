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
    var re = new RegExp("true*");
    if (re.test(theString)) {
        return true;
    } else {
        return false;
    }
}

/**
 * Get a unix timestamp
 * (the standard is seconds btw)
 * and convert it to human readable format
 * @param unix_timestamp
 * @returns {string}
 */
function getFormattedDate(unix_timestamp) {
    var IST_offset = 19800;
    unix_timestamp = unix_timestamp + IST_offset
    var date = new Date(unix_timestamp * 1000);
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    var strTime = hours + ':' + minutes + ' ' + ampm;
    strTime = date.getDate() + "/" + date.getMonth() + "/" + date.getFullYear() + " " + strTime
    return strTime;
// // Hours part from the timestamp
//     var hours = date.getHours();
// // Minutes part from the timestamp
//     var minutes = "0" + date.getMinutes();
// // Seconds part from the timestamp
//     var seconds = "0" + date.getSeconds();
//
// // Will display time in 10:30:23 format
//     var formattedTime = date.getDate() + "/" + date.getMonth() + "/" + date.getFullYear() + ", " +  hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
//     return formattedTime
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
 * Error response handler,
 * handles:
 *      new Error()
 *      orchestrate error
 *      quickblox error
 * @param err
 * @param res
 */
function sendErrors(err, res) {
    var responseObj = {}
    var statusCode = 422
    var errorsArray = ["An unexpected error occured"]

    try {
        //some well thought out javascript here
        //err.body.message means undefined.message which throws an exception
        //but checking it in this manner (and knowing that "and" evaluations will ignore the rest 
        //if the first condition is false
        //this is as close to programming unagi you can get.

        //if already given an array
        console.log("this is the error ----------")
        console.log(err)
        console.log("this is the error ----------")
        if (err.constructor === Array) {
            errorsArray = err
        } else if (err.body && err.body.message) {
            console.log("orchestrate error")
            //orchestrate new Error
            errorsArray = [err.body.message]
            statusCode = err.statusCode
        } else if (err.detail) {
            //quickblox error
            /**
             * "obj": {
                "code": 403,
                "status": "403 Forbidden",
                "message": {
                  "errors": [
                    "You don't have appropriate permissions to perform this operation"
                  ]
                },
                "detail": [
                  "You don't have appropriate permissions to perform this operation"
                ]
                }
             */
            //TODO : stupid quickblox error that breaks this by have detail = null
            /**
             * {
              "errors": [
                {
                  "code": null,
                  "message": "Resource not found"
                }
              ],
              "obj": {
                "code": 404,
                "status": "404 Not Found",
                "message": {
                  "code": null,
                  "message": "Resource not found"
                },
                "detail": null
              }
            }
             */
            console.log("quickblox error")
            statusCode = err.code
            errorsArray = err.detail
        } else if (err.message) {
            console.log("javascript error")
            //javascript new Error
            errorsArray = [err.message]
        }
    } catch (e) {
        console.log("koi nae, non standard error hai")
    } finally {
        responseObj["errors"] = errorsArray
        responseObj["obj"] = err
        res.status(statusCode)
        res.json(responseObj)
    }
}


/**
 * if the time is within the last 1 minute
 * this is the definition of recent as far as this method
 * is concerned
 * @param timestamp
 * @returns {boolean}
 */
function isRecent(timestamp) {
    var date = new Date()
    console.log(timestamp + " > " + ((date.getTime() / 1000) - 60))
    if (timestamp > ((date.getTime() / 1000) - 60))
        return true
    else
        return false
}

/**
 * Proper unix time, in seconds!
 * @returns {number}
 */
function getCurrentUnixTime() {
    var date = new Date()
    return (date.getTime() / 1000)
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
 * Remove any value which is undefined in a js object
 * @param test
 */
function undefinedRemover(test) {
    for (var i in test) {
        if (test[i] === null || test[i] === undefined) {
            // test[i] === undefined is probably not very useful here
            delete test[i];
        }
    }
    return test
}

/**
 * Capture a razorpay payment for authorization
 * @param paymentId the razorpay generated payment Id
 * @param amount authorized amount in paise
 */
var captureRazorPayment = function (paymentId, amount) {
    var request = require('request')
    var captureStatus = kew.defer()
    if (!paymentId || !amount) {
        captureStatus.reject(new Error("Invalid paymentId and/or amount"))
    } else {
        //example razorpay URL (with auth)
        //https://rzp_test_Ad93zqidD9eZwy:69b2e24411e384f91213f22a@api.razorpay.com/v1/payments

        var baseURL = "https://" + config.razorpay.key + ":" + config.razorpay.secret + "@api.razorpay.com/v1/payments/" + paymentId + "/capture"

        //https://www.npmjs.com/package/request
        var form = {
            amount: parseInt(amount)
        }

        request.post({url: baseURL, form: form}, function (err, httpResponse, body) {
            console.log(body)
            if (httpResponse.statusCode >= 400) {
                captureStatus.reject(err)
                console.log("payment capture failed");
            } else {
                captureStatus.resolve(body)
                console.log("payment capture succeeded");
            }
        });
    }
    return captureStatus
}

var getUniqueObjectsById = function (theArrayOfObjects) {
    // var arr = {};
    //
    // for ( var i=0, len=things.thing.length; i < len; i++ )
    //     arr[things.thing[i]['place']] = things.thing[i];
    //
    // things.thing = new Array();
    // for ( var key in arr )
    //     things.thing.push(arr[key]);

    var theMap = {}
    theArrayOfObjects.forEach(function (anObject) {
        theMap[anObject["id"]] = anObject
    })

    var theUniqueArray = []
    Object.keys(theMap).forEach(function(theKey){
        theUniqueArray.push(theMap[theKey])
    })

    return theUniqueArray
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
exports.undefinedRemover = undefinedRemover
exports.getCurrentUnixTime = getCurrentUnixTime
exports.getFormattedDate = getFormattedDate
exports.captureRazorPayment = captureRazorPayment
exports.sendSms = sendSms
exports.getUniqueObjectsById = getUniqueObjectsById