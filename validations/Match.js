var constants = require('../constants')
var validator = require('validator');
var config = require('../config.js');

validatePostMatch = function (reqBody) {
    var errors = []
    if (validator.isNull(reqBody.title))
        errors.push("Title field cannot be empty")

    if (validator.isNull(reqBody.description))
        errors.push("Description field cannot be empty")

    if (!validator.isIn(reqBody.sport, constants.sports))
        errors.push("Invalid sport type")

    if (validator.isTimeInFuture(reqBody.playing_time))
        reqBody.playing_time = parseInt(reqBody.playing_time)
    else
        errors.push("Match time should be valid and in the future")

    if (validator.isInt(reqBody.slots, {min: 2}))
        reqBody.slots = parseInt(reqBody.slots)
    else
        errors.push("A match must have more than 1 slot")

    //reqBody.location_name is optional

    if (validator.isValidLatLong(reqBody.lat))
        reqBody.lat = parseFloat(reqBody.lat)
    else
        errors.push("Enter a valid Latitude")

    if (validator.isValidLatLong(reqBody.long))
        reqBody.long = parseFloat(reqBody.long)
    else
        errors.push("Enter a valid Longitude")

    if (validator.isBoolean(reqBody.isFacility))
        reqBody.isFacility = customUtils.stringToBoolean(reqBody.isFacility)
    else
        errors.push("isFacility can be true or false only")

    if (validator.isInt(reqBody.skill_level_min) &&
        validator.isInt(reqBody.skill_level_max) &&
        parseInt(reqBody.skill_level_min) <= parseInt(reqBody.skill_level_max)) {
        reqBody.skill_level_min = parseInt(reqBody.skill_level_min)
        reqBody.skill_level_max = parseInt(reqBody.skill_level_max)
    } else {
        errors.push("The skill level must be a valid range of 1-5")
    }
    return {
        errors: errors,
        reqBody: reqBody
    }
}

validatePostEvent = function (req) {
    //if you send more files with the same key. you get an array.
    //that will probably throw an exception
    var reqFiles = req.files
    console.log(reqFiles)

    var reqBody = req.body
    var errors = []

    if (validator.isNull(reqFiles.image) || !validator.isImage(reqFiles.image.mimetype))
        errors.push(constants.validations.event.cover_photo_invalid);

    if (validator.isNull(reqBody.title))
        errors.push(constants.validations.event.title_empty_message)

    if (validator.isLength(reqBody.sub_title, {min: 0, max: constants.validations.event.sub_title_max_length}))
        errors.push(constants.validations.event.title_empty_message)

    if (validator.isLength(reqBody.description, {min: 0, max: constants.validations.event.description_max_length}))
        errors.push(constants.validations.event.description_max_length_message)

    if (!validator.isIn(reqBody.sport, constants.sports))
        errors.push(constants.validations.invalid_sport_type)

    if (validator.isTimeInFuture(reqBody.playing_time))
        reqBody.playing_time = parseInt(reqBody.playing_time)
    else
        errors.push(constants.validations.event.time_in_future)

    if (validator.isInt(reqBody.slots, {min: constants.validations.event.slot_min}))
        reqBody.slots = parseInt(reqBody.slots)
    else
        errors.push(constants.validations.event.slot_min_message)

    //reqBody.location_name is optional
    if (validator.isValidLatLong(reqBody.lat))
        reqBody.lat = parseFloat(reqBody.lat)
    else
        errors.push(constants.validations.invalid_lat_message)

    if (validator.isValidLatLong(reqBody.long))
        reqBody.long = parseFloat(reqBody.long)
    else
        errors.push(constants.validations.invalid_long_message)

    if (validator.isBoolean(reqBody.isPaid)) {
        reqBody.isPaid = customUtils.stringToBoolean(reqBody.isPaid)
        if (reqBody.isPaid && !validator.isInt(reqBody.price, {min: 1}))
            errors.push(constants.validations.event.price_invalid_message)
    }
    else
        errors.push(constants.validations.event.isPaid_boolean_message)

    if (!validator.isURL(reqBody.google_form))
        errors.push(constants.validations.event.invalid_url)

    //if (validator.isBoolean(reqBody.isFacility))
    //    reqBody.isFacility = customUtils.stringToBoolean(reqBody.isFacility)
    //else
    //    errors.push("isFacility can be true or false only")

    if (validator.isInt(reqBody.skill_level_min) &&
        validator.isInt(reqBody.skill_level_max) &&
        reqBody.skill_level_min <= reqBody.skill_level_max) {
        reqBody.skill_level_min = parseInt(reqBody.skill_level_min)
        reqBody.skill_level_max = parseInt(reqBody.skill_level_max)
    } else {
        errors.push(constants.validations.invalid_skill_rating_range_message)
    }
    return {
        errors: errors,
        reqBody: reqBody,
        reqFiles: reqFiles
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
    validatePostMatch: validatePostMatch,
    validatePostEvent: validatePostEvent
}