var constants = require('../constants')
var validator = require('validator');
var config = require('../config.js');

validator.extend('isTimeInFuture', function (time) {
    console.log(time)
    if (!time)
        return false

    var date = new Date()
    var currentTime = date.getTime()
    console.log(currentTime)
    if (parseInt(time) > (currentTime / 1000))
        return true
    else
        return false
});

validator.extend('isValidLatLong', function (latOrLong) {
    var regex = /^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,6}/
    return latOrLong.match(regex) ? true : false
})

validateUpdateSports = function (reqBody) {
    var newReqBody = {}
    var errors = []
    console.log(reqBody)
    for (var sportKey in reqBody) {
        if (constants.sports.indexOf(sportKey) <= -1) {
            errors.push("The sport " + sportKey + " is an invalid key")
            continue;
        }
        if (!validator.isInt(reqBody[sportKey], {min: constants.skill_rating_min, max: constants.skill_rating_max})) {
            errors.push("Sport : " + sportKey + " has an invalid rating")
            continue
        }
        newReqBody[sportKey] = parseInt(reqBody[sportKey])
    }
    //if (validator.isNull(reqBody.title))
    //    errors.push("Title field cannot be empty")
    //
    //if (validator.isNull(reqBody.description))
    //    errors.push("Description field cannot be empty")
    //
    //if (!validator.isIn(reqBody.sport, constants.sports))
    //    errors.push("Invalid sport type")
    //
    //if (validator.isTimeInFuture(reqBody.playing_time))
    //    reqBody.playing_time = parseInt(reqBody.playing_time)
    //else
    //    errors.push("Match time should be valid and in the future")
    //
    //if (validator.isInt(reqBody.slots, {min: 2}))
    //    reqBody.slots = parseInt(reqBody.slots)
    //else
    //    errors.push("A match must have more than 1 slot")
    //
    ////reqBody.location_name is optional
    //
    //if (validator.isValidLatLong(reqBody.lat))
    //    reqBody.lat = parseFloat(reqBody.lat)
    //else
    //    errors.push("Enter a valid Latitude")
    //
    //if (validator.isValidLatLong(reqBody.long))
    //    reqBody.long = parseFloat(reqBody.long)
    //else
    //    errors.push("Enter a valid Longitude")
    //
    //if (validator.isBoolean(reqBody.isFacility))
    //    reqBody.isFacility = customUtils.stringToBoolean(reqBody.isFacility)
    //else
    //    errors.push("isFacility can be true or false only")
    //
    //if (validator.isInt(reqBody.skill_level_min) &&
    //    validator.isInt(reqBody.skill_level_max) &&
    //    reqBody.skill_level_min <= reqBody.skill_level_max) {
    //    reqBody.skill_level_min = parseInt(reqBody.skill_level_min)
    //    reqBody.skill_level_max = parseInt(reqBody.skill_level_max)
    //} else {
    //    errors.push("The skill level must be a valid range")
    //}
    return {
        errors: errors,
        reqBody: newReqBody
    }
}


/**
 * The great schema validation failure.
 * This was a neater way of doing it.
 * But not great enough documentation to make it work!
 * You go bro!
 * @type {{title: {notEmpty: {errorMessage: string}}, description: {notEmpty: {errorMessage: string}}, type: {optional: boolean, isIn: {options: string[], errorMessage: string}}}}
 */
//exports.postMatch = {
//    "title": {
//        notEmpty: {
//            errorMessage: 'Title field cannot be empty'
//        }
//    },
//    "description": {
//        notEmpty: {
//            errorMessage: 'description field cannot be empty'
//        }
//    },
//    //"sport": {
//    //    isIn: {
//    //        options: [
//    //            "badminton",
//    //            "basketball",
//    //            "bowling",
//    //            "cricket",
//    //            "cycling",
//    //            "football",
//    //            "golf",
//    //            "hockey",
//    //            "pool",
//    //            "running",
//    //            "snooker",
//    //            "squash",
//    //            "swimming",
//    //            "tennis",
//    //            "tt",
//    //            "ultimatefrisbee"
//    //        ],
//    //        errorMessage: "Invalid sport type"
//    //    }
//    //}
//    //"time": {
//    //    isInt: {
//    //        errorMessage: 'Invalid time'
//    //    }
//    //},
//    //"slots": {
//    //    isInt: {
//    //        errorMessage: 'Enter a valid number of slots for the match'
//    //    }
//    //},
//    //"location_name": {
//    //    notEmpty: {
//    //        errorMessage: "Enter a location name"
//    //    }
//    //},
//    //"lat": {
//    //    isValidLat : {
//    //        errorMessage: "Latitude/Longitude is invalid"
//    //    }
//    //},
//    //"long": {
//    //    isValidLat : {
//    //        errorMessage: "Latitude/Longitude is invalid"
//    //    }
//    //},
//    "type": {
//        //notEmpty: {
//        //    errorMessage: "Invalid type. It can be only 'event' or 'match'"
//        //},
//        optional : false,
//        isIn: {
//            options: ['event', 'match'],
//            errorMessage: "Invalid type. It can be only 'event' or 'match'"
//        }
//    }
//    //"title": {
//    //    notEmpty: {
//    //        errorMessage: "Title cannot be empty"
//    //    }
//    //},
//    //"isFacility": {
//    //    Boolean: {
//    //        errorMessage: ""
//    //    }
//    //}
//    //"no_of_players": {
//    //    notEmpty: {
//    //        errorMessage: ""
//    //    },
//    //    isInt: true
//    //},
//}

module.exports = {
    validateUpdateSports: validateUpdateSports
}