var constants = require('../constants')
var validator = require('validator');
var config = require('../config.js');
var customUtils = require('../utils.js');

validatePostMatch = function (reqBody) {
    var errors = []

    if (validator.isNull(reqBody.invitedUsersIds)) {
        reqBody.invitedUserIdList = []
    } else {
        reqBody.invitedUserIdList = reqBody.invitedUsersIds.split(',')
    }
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

    if (validator.isBoolean(reqBody.isFacility)) {
        reqBody.isFacility = customUtils.stringToBoolean(reqBody.isFacility)
        if (reqBody.isFacility) {
            if (validator.isNull(reqBody.facilityId)) {
                //you can add logic to see if the facility is valid
                //for data integrity sake
                errors.push("Please select the facility to play in")
            }
        }

    }
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

/**
 * when 'fix a match' is clicked
 * @param reqBody
 */
validateFixAMatch = function (reqBody) {
    var errors = []

    reqBody.slots = 2
    reqBody.slots_filled = 1
    reqBody.skill_level_min = 1
    reqBody.skill_level_max = 5

    //special field -- the user that the person has been invited to
    if (validator.isNull(reqBody.inviteeId))
        errors.push("Please specify the invited user (inviteeId)")

    //borrowed validations
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

    return {
        errors: errors,
        reqBody: reqBody
    }
}

validatePatchMatch = function (reqBody) {
    var errors = []

    if(!validator.isNull(reqBody.playing_time)) {
        if (validator.isTimeInFuture(reqBody.playing_time))
            reqBody.playing_time = parseInt(reqBody.playing_time)
        else
            errors.push("Match time should be valid and in the future")
    }

    if (!validator.isNull(reqBody.lat)) {
        if (validator.isValidLatLong(reqBody.lat))
            reqBody.lat = parseFloat(reqBody.lat)
        else
            errors.push("Enter a valid Latitude")
    }

    if (!validator.isNull(reqBody.long)) {
        if (validator.isValidLatLong(reqBody.long))
            reqBody.long = parseFloat(reqBody.long)
        else
            errors.push("Enter a valid Longitude")
    }

    if (!validator.isNull(reqBody.long)) {
        if (validator.isValidLatLong(reqBody.long))
            reqBody.long = parseFloat(reqBody.long)
        else
            errors.push("Enter a valid Longitude")
    }

    if (!validator.isNull(reqBody.isFacility)) {
        if (validator.isBoolean(reqBody.isFacility))
            reqBody.isFacility = customUtils.stringToBoolean(reqBody.isFacility)
        else
            errors.push("isFacility can be true or false only")
    }

    if (!validator.isNull(reqBody.slots)) {
        if (validator.isInt(reqBody.slots, {min: 2}))
            reqBody.slots = parseInt(reqBody.slots)
        else
            errors.push("slots must be minimum of 2")
    }
    

    if (!validator.isNull(reqBody.isAdminMarked)) {
        if (validator.isBoolean(reqBody.isAdminMarked)) {
            console.log("admin marked value:")
            console.log(reqBody.isAdminMarked)
            reqBody.isAdminMarked = customUtils.stringToBoolean(reqBody.isAdminMarked)
        }
        else {
            errors.push("isAdminMarked can be true or false only")
        }

    }

    if(!validator.isNull(reqBody.skill_level_min) && !validator.isNull(reqBody.skill_level_max)) {
        if (validator.isInt(reqBody.skill_level_min) &&
            validator.isInt(reqBody.skill_level_max) &&
            parseInt(reqBody.skill_level_min) <= parseInt(reqBody.skill_level_max)) {
            reqBody.skill_level_min = parseInt(reqBody.skill_level_min)
            reqBody.skill_level_max = parseInt(reqBody.skill_level_max)
        } else {
            errors.push("The skill level must be a valid range of 1-5")
        }
    }
    

    if (!validator.isNull(reqBody.note)) {
        //do nothing so far, maybe someday you want to put a string limit
    }

    console.log(reqBody)

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

    if (validator.isNull(reqBody.priceText))
        errors.push(constants.validations.price_text_null)

    if (validator.isNull(reqBody.contactUs))
        errors.push(constants.validations.event.contactUs)

    if (validator.isNull(reqFiles.image) || !validator.isImage(reqFiles.image.mimetype))
        errors.push(constants.validations.event.cover_photo_invalid);

    if (validator.isNull(reqBody.title))
        errors.push(constants.validations.event.title_empty_message)
    //
    if (validator.isLength(reqBody.sub_title, {min: 0, max: constants.validations.event.sub_title_max_length}))
        errors.push(constants.validations.event.title_empty_message)

    if (validator.isLength(reqBody.description, {min: 0, max: constants.validations.event.description_max_length}))
        errors.push(constants.validations.event.description_max_length_message)

    //if (!validator.isIn(reqBody.sport, constants.sports))
    //    errors.push(constants.validations.invalid_sport_type)

    if (validator.isTimeInFuture(reqBody.playing_time))
        reqBody.playing_time = parseInt(reqBody.playing_time)
    else
        errors.push(constants.validations.event.time_in_future)

    if (validator.isTimeInFuture(reqBody.lastRegDate))
        reqBody.playing_time = parseInt(reqBody.lastRegDate)
    else
        errors.push(constants.validations.event.reg_time_in_future)

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
        if (reqBody.isPaid && !validator.isInt(reqBody.price, {min: 1})) {
            reqBody.price = undefined
            errors.push(constants.validations.event.price_invalid_message)
        } else {
            reqBody.price = parseInt(reqBody.price)
        }
    }
    else {
        errors.push(constants.validations.event.isPaid_boolean_message)
        reqBody.price = undefined
    }


    if (!validator.isURL(reqBody.google_form))
        errors.push(constants.validations.event.invalid_url)

    if (validator.isInt(reqBody.slots, {min: 2}))
        reqBody.slots = parseInt(reqBody.slots)
    else
        errors.push("An event must have more than 1 slot")

    //if (validator.isBoolean(reqBody.isFacility))
    //    reqBody.isFacility = customUtils.stringToBoolean(reqBody.isFacility)
    //else
    //    errors.push("isFacility can be true or false only")

    //if (validator.isInt(reqBody.skill_level_min) &&
    //    validator.isInt(reqBody.skill_level_max) &&
    //    reqBody.skill_level_min <= reqBody.skill_level_max) {
    //    reqBody.skill_level_min = parseInt(reqBody.skill_level_min)
    //    reqBody.skill_level_max = parseInt(reqBody.skill_level_max)
    //} else {
    //    errors.push(constants.validations.invalid_skill_rating_range_message)
    //}
    return {
        errors: errors,
        reqBody: reqBody,
        reqFiles: reqFiles
    }
}

validatePatchEvent = function (req) {
    //if you send more files with the same key. you get an array.
    //that will probably throw an exception
    var reqFiles = req.files
    console.log(reqFiles)

    var reqBody = req.body
    var errors = []

    //if (validator.isNull(reqBody.priceText))
    //    errors.push(constants.validations.price_text_null)

    //if (validator.isNull(reqBody.contactUs))
    //    errors.push(constants.validations.event.contactUs)

    if(!validator.isNull(reqFiles.image)) {
        if (!validator.isImage(reqFiles.image.mimetype))
            errors.push(constants.validations.event.cover_photo_invalid);
    }

    //if (validator.isNull(reqBody.title))
    //    errors.push(constants.validations.event.title_empty_message)
    //
    if(!validator.isNull(reqBody.sub_title)) {
        if (validator.isLength(reqBody.sub_title, {min: 0, max: constants.validations.event.sub_title_max_length}))
            errors.push(constants.validations.event.title_empty_message)
    }

    if(!validator.isNull(reqBody.description)) {
        if (validator.isLength(reqBody.description, {min: 0, max: constants.validations.event.description_max_length}))
            errors.push(constants.validations.event.description_max_length_message)
    }

    if(!validator.isNull(reqBody.playing_time)) {
        if (validator.isTimeInFuture(reqBody.playing_time))
            reqBody.playing_time = parseInt(reqBody.playing_time)
        else
            errors.push(constants.validations.event.time_in_future)
    }

    if(!validator.isNull(reqBody.lastRegDate)) {
        if (validator.isTimeInFuture(reqBody.lastRegDate))
            reqBody.playing_time = parseInt(reqBody.lastRegDate)
        else
            errors.push(constants.validations.event.reg_time_in_future)
    }

    if(!validator.isNull(reqBody.lat)) {
        //reqBody.location_name is optional
        if (validator.isValidLatLong(reqBody.lat))
            reqBody.lat = parseFloat(reqBody.lat)
        else
            errors.push(constants.validations.invalid_lat_message)
    }

    if(!validator.isNull(reqBody.long)) {
        if (validator.isValidLatLong(reqBody.long))
            reqBody.long = parseFloat(reqBody.long)
        else
            errors.push(constants.validations.invalid_long_message)
    }

    if(!validator.isNull(reqBody.isDiscoverable)) {
        if (validator.isBoolean(reqBody.isDiscoverable)) {
            reqBody.isDiscoverable = customUtils.stringToBoolean(reqBody.isDiscoverable)
        }
    }

    if(!validator.isNull(reqBody.isFeatured)) {
        if (validator.isBoolean(reqBody.isFeatured)) {
            reqBody.isFeatured = customUtils.stringToBoolean(reqBody.isFeatured)
        }
    }

    if(!validator.isNull(reqBody.isPaid)) {
        if (validator.isBoolean(reqBody.isPaid)) {
            reqBody.isPaid = customUtils.stringToBoolean(reqBody.isPaid)
            if (reqBody.isPaid && !validator.isInt(reqBody.price, {min: 1})) {
                reqBody.price = undefined
                errors.push(constants.validations.event.price_invalid_message)
            } else {
                reqBody.price = parseInt(reqBody.price)
            }
        }
        else {
            errors.push(constants.validations.event.isPaid_boolean_message)
            reqBody.price = undefined
        }
    }

    if(!validator.isNull(reqBody.google_form)) {
        if (!validator.isURL(reqBody.google_form))
            errors.push(constants.validations.event.invalid_url)
    }

    //if (validator.isBoolean(reqBody.isFacility))
    //    reqBody.isFacility = customUtils.stringToBoolean(reqBody.isFacility)
    //else
    //    errors.push("isFacility can be true or false only")

    //if (validator.isInt(reqBody.skill_level_min) &&
    //    validator.isInt(reqBody.skill_level_max) &&
    //    reqBody.skill_level_min <= reqBody.skill_level_max) {
    //    reqBody.skill_level_min = parseInt(reqBody.skill_level_min)
    //    reqBody.skill_level_max = parseInt(reqBody.skill_level_max)
    //} else {
    //    errors.push(constants.validations.invalid_skill_rating_range_message)
    //}
    return {
        errors: errors,
        reqBody: reqBody,
        reqFiles: reqFiles
    }
}


/**
 * The great schema matchValidation failure.
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
    validatePatchMatch: validatePatchMatch,
    validatePostEvent: validatePostEvent,
    validateFixAMatch: validateFixAMatch,
    validatePatchEvent : validatePatchEvent
}