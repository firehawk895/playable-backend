var express = require('express');
var router = express.Router();

var passport = require('passport');
var _ = require('lodash');
var bcrypt = require('bcryptjs');
var request = require('request');

var kew = require('kew');
var async = require('async');

var multer = require('multer'),
    fs = require('fs');

var config = require('../config.js');
var customUtils = require('../utils.js');

var QB = require('quickblox');
QB.init(config.qb.appId, config.qb.authKey, config.qb.authSecret, false);

var constants = require('../constants.js');

var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var date = new Date();
var now = date.getTime();

var CronJob = require('cron').CronJob;

var userValidation = require('../validations/User.js');

//var mailgun = require('mailgun-js')({apiKey: config.mailgun.key, domain: config.mailgun.domain});
var validator = require('validator');
var jwt = require('jsonwebtoken');
var msg91 = require("msg91")(config.msg91.authkey, config.msg91.senderId, config.msg91.routeNumber);

validator.extend('isImage', function (mimetype) {
    if (mimetype.match(/^image.*/)) return true;
    else return false;
});

router.post('/mysports', [passport.authenticate('bearer', {session: false}), function (req, res) {
    responseObj = {}
    var userId = req.user.results[0].value.id;

    var validationResponse = userValidation.validateUpdateSports(req.body);

    req.body = validationResponse.reqBody
    var errors = validationResponse.errors

    if (errors.length > 0) {
        customUtils.sendErrors(errors, 422)
    } else {
        db.merge("users", userId, {
            sports: req.body
        })
            .then(function (result) {
                responseObj["data"] = [];
                responseObj["msg"] = "Sports Updated";
                res.status(201);
                res.json(responseObj);
            })
            .fail(function (err) {
                customUtils.sendErrors([err.body.message], 422)
            })
    }
}])

/**
 * google login exchanging encrypted jwt tokens
 */
router.post('/auth/google', qbchat.getSession(function (err, session) {
    if (err) {
        console.log("Recreating session");
        qbchat.createSession(function (err, result) {
            if (err) {
                customUtils.sendErrors(["Can't connect to the chat server, try again later"], 503)
            } else next();
        })
    } else next();
}), function (req, res) {
    var responseObj = {}

    var encryptedJwt = req.body.code;
    var isVerified = undefined;

    var decoded = undefined;
    var header = undefined;
    var payload = undefined;

    var avatar = undefined;
    var avatarThumb = undefined;

    var errors = new Array();

    if (validator.isNull(encryptedJwt)) errors.push("No JWT Token provided");
    else {
        decoded = jwt.decode(encryptedJwt, {complete: true});

        if (decoded) {
            header = decoded.header;
            payload = decoded.payload;
            if (validator.isNull(payload.sub)) errors.push("Profile ID is missing");
            if (validator.isNull(payload.email)) errors.push("Email is missing");
            if (validator.isNull(payload.name)) errors.push("Name is missing");
            //if profile is missing set your own profile, because it has not been set in google.
            if (validator.isNull(payload.picture)) {
                avatar = "https://s3-ap-southeast-1.amazonaws.com/playable-prod/default_profile_photo-1.png";
                avatarThumb = "https://s3-ap-southeast-1.amazonaws.com/playable-prod/default_profile_photo-1.png";
            } else {
                avatar = payload.picture.replace('s96-c/', '');
                avatarThumb = payload.picture;
            }
        } else {
            errors.push("Invalid JWT or JWT has expired. Please reissue a token")
        }
    }

    if (errors.length > 0) {
        customUtils.sendErrors(errors, 422)
    } else {
        console.log("entering search?");
        db.newSearchBuilder()
            .collection('users')
            .query('value.google:`' + payload.sub + '`')
            .then(function (fetchedUser) {
                if (fetchedUser.body.total_count === 1) {
                    //already signed up by google
                    console.log("already signed up by google");
                    //login time
                    generateTokenAndLogin(fetchedUser, res);
                } else {
                    //not already signed up by google
                    console.log("not already signed up by google");

                    db.newSearchBuilder()
                        .collection('users')
                        .query('email:`' + payload.email + '`')
                        .then(function (user) {
                            if (user.body.total_count === 0) {
                                //email does not exist
                                console.log("email does not exist, sign up time");
                                signUpFreshGoogleUser(payload, avatar, avatarThumb, res);
                            } else {
                                //email does exist, linking accounts...
                                console.log("email does exist, linking accounts...");
                                console.log(user.body.results[0].value.id);
                                var mergeData = {
                                    "google": payload.sub,
                                    "avatar": avatar,
                                    "avatarThumb": avatarThumb
                                };
                                db.merge('users', user.body.results[0].value.id, mergeData)
                                    .then(function (linkedUser) {
                                        console.log("merging happened");
                                        console.log(user.body.results[0].value);
                                        responseObj['data'] = user.body.results[0].value;
                                        responseObj['data']['google'] = mergeData.google;
                                        responseObj['data']['avatar'] = mergeData.avatar;
                                        responseObj['data']['avatarThumb'] = mergeData.avatarThumb;
                                        console.log(responseObj);

                                        var accessToken = customUtils.generateToken();
                                        db.put('tokens', accessToken, {
                                            "user": responseObj['data']['id']
                                        })
                                            .then(function (result) {
                                                db.newGraphBuilder()
                                                    .create()
                                                    .from('tokens', accessToken)
                                                    .related('hasUser')
                                                    .to('users', responseObj['data']['id'])
                                                    .then(function (result) {
                                                        responseObj['data']["access_token"] = accessToken;
                                                        responseObj['data']["password"] = undefined;
                                                        res.status(201);
                                                        res.json(responseObj);
                                                    })
                                            })
                                    })
                            }
                        })
                }
            })
            .fail(function (err) {
                customUtils.sendErrors(['Service failure. Contact Playable immediately'], 503)
            })
    }
});

router.post('/auth/facebook', function (req, res, next) {
        qbchat.getSession(function (err, session) {
            if (err) {
                console.log("Recreating session");
                qbchat.createSession(function (err, result) {
                    if (err) {
                        customUtils.sendErrors(["Can't connect to the chat server, try again later"], 503)
                    } else next();
                })
            } else next();
        })
    }, function (req, res) {
        var responseObj = {};
        var errors = new Array();
        var changeEmail = false;

        var accessToken = req.body.code;
        if (validator.isNull(accessToken)) errors.push("Access Token not provided");

        if (errors.length > 0) {
            customUtils.sendErrors(errors, 422)
        } else {
            //--------------URLs-----------------------------------------------------------------------
            accessTokenUrl = "https://graph.facebook.com/v2.3/me?fields=id,name,email,cover&access_token=" + accessToken;
            //--------------URLs End -------------------------------------------------------------------
            request.get({url: accessTokenUrl, json: true}, function (err, response, payload) {
                if (response.statusCode !== 200) {
                    return res.status(response.statusCode).send({errors: [payload.error.message]});
                }
                if (validator.isNull(payload.id)) return res.status(409).send("Profile ID could not be retrieved");
                if (validator.isNull(payload.name)) return res.status(409).send("Name could not be retrieved");
                if (validator.isNull(payload.cover)) {
                    log.info(payload, "Cover photo could not be retrieved - kamina user probably denied the permission")
                    payload.cover = constants.cover
                }
                if (validator.isNull(payload.email)) {
                    payload.email = "playable" + customUtils.generateToken(4) + "@mailinator.com";
                    changeEmail = true;
                }

                avatar = "https://graph.facebook.com/" + payload.id + "/picture?type=large";
                avatarThumb = "https://graph.facebook.com/" + payload.id + "/picture";

                //----------------------------------------sign up scenarios ----------------------------
                console.log("entering search?");
                db.newSearchBuilder()
                    .collection('users')
                    .query('value.facebook:`' + payload.id + '`')
                    .then(function (fetchedUser) {
                        if (fetchedUser.body.total_count === 1) {
                            //already signed up by facebook
                            console.log("already signed up by facebook");
                            //login time
                            generateTokenAndLogin(fetchedUser, res);
                            extractFacebookFriends(fetchedUser.body.results[0].value.id, accessToken);
                        } else {
                            //not already signed up by facebook
                            console.log("not already signed up by facebook");

                            db.newSearchBuilder()
                                .collection('users')
                                .query('email:`' + payload.email + '`')
                                .then(function (user) {
                                    if (user.body.total_count === 0) {
                                        //email does not exist
                                        console.log("email does not exist, sign up time");
                                        //this also handles extracting friends
                                        signUpFreshFacebookUser(payload, avatar, avatarThumb, res, changeEmail, accessToken);
                                    } else {
                                        //email does exist, linking accounts...
                                        console.log("email does exist, linking accounts...");
                                        console.log(user.body.results[0].value.id);
                                        var mergeData = {
                                            "facebook": payload.id,
                                            "avatar": avatar,
                                            "avatarThumb": avatarThumb
                                        };
                                        db.merge('users', user.body.results[0].value.id, mergeData)
                                            .then(function (linkedUser) {
                                                console.log("merging happened");
                                                console.log(user.body.results[0].value);
                                                responseObj['data'] = user.body.results[0].value;
                                                responseObj['data']['facebook'] = mergeData.facebook;
                                                responseObj['data']['avatar'] = mergeData.avatar;
                                                responseObj['data']['avatarThumb'] = mergeData.avatarThumb;
                                                console.log(responseObj);

                                                var accessToken = customUtils.generateToken();
                                                db.put('tokens', accessToken, {
                                                    "user": responseObj['data']['id']
                                                })
                                                    .then(function (result) {
                                                        db.newGraphBuilder()
                                                            .create()
                                                            .from('tokens', accessToken)
                                                            .related('hasUser')
                                                            .to('users', responseObj['data']['id'])
                                                            .then(function (result) {
                                                                responseObj['data']["access_token"] = accessToken;
                                                                responseObj['data']["password"] = undefined;
                                                                res.status(201);
                                                                res.json(responseObj);
                                                            })
                                                    })
                                            })
                                        extractFacebookFriends(user.body.results[0].value.id, accessToken)
                                    }
                                })
                        }
                    })
                    .fail(function (err) {
                        customUtils.sendErrors(['Service failure. Contact Playable immediately'], 422)
                    })
                //--------------------------------end of signup scenarios----------------------------------------------------


            });
        }
    }
)

/**
 * extracts and merges facebook friend data
 * -----------------------------
 * Data looks like this:
 * -----------------------------
 * {
 *  "data": [
 *     {
 *        "name": "Ankan Adhikari",
 *        "id": "10152996688646213"
 *     },
 *     {
 *        "name": "Sharan Bhargava",
 *        "id": "10153755428974359"
 *     },
 *     {
 *        "name": "Tushar Banka",
 *        "id": "10206602006322787"
 *     }
 *  ],
 *  "paging": {
 *     "next": "https://graph.facebook.com/v2.4/897667640271151/friends?access_token=someAccessToken&limit=25&offset=25&__after_id=enc_AdBcwFC9ggIKy25omRcLqkWi6ak6QWz0BptZAktHBARYXZCZBEO5NLNMZBZCtOvyEaQiyfJcZD"
 *  },
 *  "summary": {
 *     "total_count": 1217
 *  }
 * }
 * ------------------------------
 * Last page looks like this:
 * ------------------------------
 * {
 *  "data": [
 *
 *  ],
 *  "paging": {
 *     "previous": "https://graph.facebook.com/v2.4/897667640271151/friends?limit=25&offset=0&access_token=someAccessToken"
 *  },
 *  "summary": {
 *     "total_count": 1217
 *  }
 * }
 * -------------------------------
 * @param userId
 * @param accessToken
 */
var extractFacebookFriends = function (userId, accessToken) {
    var friendsUrl = "https://graph.facebook.com/v2.3/me/friends?access_token=" + accessToken
    var friendsData = []

    var getFriends = function (theUrl) {
        request.get({url: theUrl, json: true}, function (err, response, payload) {
            if (response.statusCode == 200) {
                if (payload.data && payload.data.length > 0) {
                    //we have a few friends to store
                    friendsData.push.apply(friendsData, payload.data)
                }
                if (payload.paging) {
                    //payload.paging.previous means this is the last page
                    if (payload.paging.previous) {
                        //this is the last page, all friendsData is finally here
                        db.merge('users', userId, {
                            "facebookFriends": friendsData
                        })
                            .then(function (result) {
                            })
                            .fail(function (err) {
                            })
                    } else {
                        getFriends(payload.paging.next)
                    }
                }
            }
        })
    }
    getFriends(friendsUrl)
}

//TODO: Trim all user inputs before validating
//TODO: See that if key absent, proper error is sent
router.post('/signup', function (req, res, next) {
    qbchat.getSession(function (err, session) {
        if (err) {
            console.log("Recreating session");
            qbchat.createSession(function (err, result) {
                if (err) {
                    customUtils.sendErrors(["Can't connect to the chat server, try again later"], 503)
                } else next();
            })
        } else next();
    })
}, function (req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var name = customUtils.toTitleCase(req.body.name);
    var username = req.body.username;
    var responseObj = {};
    var errors = new Array();

    if (!validator.isLength(name, 2, 50)) errors.push("Name must be between 2-50 characters");
    if (!name.match(/^[a-zA-Z ]*$/)) errors.push("Name must contain only alphabets");
    if (!validator.isLength(username, 6, 12)) errors.push("Username must be between 6-12 characters");
    if (!username.match(/^[a-zA-Z0-9_]*$/)) errors.push("Username must contain only alphabets, numbers or underscore");
    if (!validator.isLength(password, 8, 20)) errors.push("Password must be between 8-20 characters");
    if (!validator.isEmail(email))
        errors.push("Please enter a valid mail ID");
    else
        email = email.toLowerCase();

    if (!validator.isNull(req.body.userDesc))
        if (!validator.isLength(req.body.userDesc, 20)) errors.push("Description must be greater than 20 characters");

    if (!validator.isNull(req.body.tagline))
        if (!validator.isLength(req.body.tagline, 0, 40)) errors.push("Tagline must be less than 40 characters");

    if (errors.length > 0) {
        customUtils.sendErrors(errors, 422)
    } else {
        db.newSearchBuilder()
            .collection('users')
            .query('value.email:`' + email + '` OR value.username:`' + username + '`')
            .then(function (result) {
                if (result.body.total_count === 0) {
                    var hashedPassword = bcrypt.hashSync(req.body.password, 8);
                    var isVerified = customUtils.generateToken();
                    var id = customUtils.generateToken(8)
                    var date = new Date();

                    var user = {
                        "id": id,
                        "gcmId": req.body.gcmId,
                        "name": name,
                        "username": req.body.username,
                        "email": req.body.email,
                        "password": hashedPassword,
                        "avatar": "https://s3-ap-southeast-1.amazonaws.com/playable-prod/default_profile_photo-1.png",
                        "avatarThumb": "https://s3-ap-southeast-1.amazonaws.com/playable-prod/default_profile_photo-1.png",
                        "userDesc": req.body.userDesc,
                        "tagline": req.body.tagline,
                        "phoneNumberVerified": false,
                        "isVerified": isVerified,
                        "last_seen": date.getTime(),
                        "created": date.getTime(),
                        "cover": constants.cover
                    };

                    qbchat.createUser({
                        login: user.username,
                        email: user.email,
                        password: config.qb.defaultPassword,
                        full_name: user.name,
                        custom_data: user.avatar
                    }, function (err, newUser) {
                        if (err) {
                            customUtils.sendErrors(["Chat server failure. Contact us ASAP."], 503)
                            return;
                        } else {
                            user["qbId"] = newUser.id
                            db.put('users', id, user)
                                .then(function (result) {
                                    var date = new Date();
                                    var chatObj = {
                                        "type": "newUser",
                                        "username": user['username'],
                                        "qbId": user['qbId'],
                                        "dbId": user['id'],
                                        "created": date.getTime(),
                                        "id": date.getTime()
                                    }
                                    if (typeof user['gcmId'] !== 'undefined')
                                        chatObj['gcmId'] = user['gcmId']
                                    else
                                        chatObj['gcmId'] = 'undefined'

                                    notify.emit("wordForChat", chatObj)

                                    user['password'] = undefined;

                                    var notifObj = {
                                        user: id,
                                        name: user.name
                                    };
                                    notify.emit('welcome', notifObj)
                                })
                                .then(function () {

                                    var accessToken = customUtils.generateToken();
                                    var userId = id;
                                    db.put('tokens', accessToken, {
                                        "user": userId
                                    })
                                        .then(function (result) {
                                            db.newGraphBuilder()
                                                .create()
                                                .from('tokens', accessToken)
                                                .related('hasUser')
                                                .to('users', userId)
                                                .then(function (result) {
                                                    user["access_token"] = accessToken;
                                                    responseObj["data"] = user;
                                                    res.status(201);
                                                    res.json(responseObj);
                                                })
                                        })
                                })
                                .fail(function (err) {
                                    customUtils.sendErrors([err.body.message], 503)
                                });
                        }
                    })

                } else {
                    customUtils.sendErrors(["Email ID or username already in use"], 409)
                }
            }).fail(function (err) {
                customUtils.sendErrors([err.body.message], 503)
            })
    }
});

router.post('/login', function (req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var responseObj = {};

    var errors = new Array();

    if (!validator.isLength(password, 8, 20)) errors.push("Password must be between 8-20 characters");
    if (!validator.isEmail(email)) errors.push("Invalid Email");

    if (errors.length > 0) {
        customUtils.sendErrors(errors, 422);
    } else {
        db.newSearchBuilder()
            .collection('users')
            .query('value.email:`' + email + '`')
            .then(function (user) {
                if (user.body.total_count === 1) {
                    var hash = user.body.results[0].value.password;
                    if (bcrypt.compareSync(password, hash)) {

                        // user.body.results[0].value.isVerified != "true"
                        if (false) { // change later, not checking for verification at the moment
                            res.status(409);
                            res.json({"errors": ["Please verify your Email to login"]});
                        } else {
                            var accessToken = customUtils.generateToken();
                            var userId = user.body.results[0].value.id;
                            db.put('tokens', accessToken, {
                                "user": userId
                            })
                                .then(function (result) {
                                    db.newGraphBuilder()
                                        .create()
                                        .from('tokens', accessToken)
                                        .related('hasUser')
                                        .to('users', userId)
                                        .then(function (result) {
                                            responseObj["data"] = user.body.results[0].value;
                                            responseObj["data"]["access_token"] = accessToken;
                                            responseObj["data"]["password"] = undefined;
                                            res.status(200);
                                            res.json(responseObj);
                                        })
                                })
                            //TODO: Study promises for this crap to work
                            //.fail(function (err) {
                            //    res.status(503);
                            //    res.json({"password": "Token could not be saved"});
                            //});

                            //customUtils.saveToken(email, accessToken);
                            //.then(function (result) {
                            //    console.log("token saved yeah!");
                            //    res.sendStatus(200);
                            //})
                            //.fail(function (err) {
                            //    console.log(err.body.message);
                            //    console.log("token not saved");
                            //    res.sendStatus(400);
                            //});
                        }
                    } else {
                        customUtils.sendErrors(["Entered password is incorrect"], 401)
                        //deferred.resolve(false);
                    }
                } else {
                    customUtils.sendErrors(["No Account with the entered email exists"], 422)
                    return;
                }
            }).fail(function (err) {
                customUtils.sendErrors([err.body.message], 503)
            });
    }
    //res.send('hello authed world');
});

router.post('/logout', [passport.authenticate('bearer', {session: false}), function (req, res) {
    access_token = req.query.access_token;
    var responseObj = {};

    db.remove('tokens', access_token, true)
        .then(function (result) {
            responseObj["data"] = {"success": "You have been successfully logged out"};
            res.status(200);
            res.json(responseObj);
        })
        .fail(function (err) {
            customUtils.sendErrors([err.body.message], 503)
        })

}]);

router.post('/verify/phone', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var responseObj = {}
    var errors = []
    if (!validator.isMobilePhone(req.body.phoneNumber, 'en-IN'))
        errors.push("Your Phone number is invalid");

    if (errors.length > 0) {
        customUtils.sendErrors(errors, 422)
    } else {
        var userId = req.user.results[0].value.id;
        var otp = customUtils.getRandomArbitrary(1000, 9999)

        var date = new Date()
        var now = date.getTime()
        var payload = {
            'phoneNumber': req.body.phoneNumber,
            'otp': otp,
            'otpExpiry': now + config.msg91.otpExpiry
        }

        async.parallel([
                function (callback) {
                    db.merge('users', userId, payload)
                        .then(function (result) {
                            callback(null, "")
                        })
                        .fail(function (err) {
                            callback(err, "")
                        })
                },
                function (callback) {
                    var message = "Your OTP is " + otp + ". Please verify it in the playable app."
                    console.log(message)
                    msg91.send(req.body.phoneNumber, message, function (err, response) {
                        if (err) {
                            callback(err, "")
                        } else {
                            callback(null, response)
                        }
                    });
                }
            ],
            function (err, results) {
                if (err) {
                    customUtils.sendErrors(["Saving/Sending the OTP failed. Please try again later."], 503)
                } else {
                    responseObj["data"] = []
                    res.status(200)
                    res.json(responseObj)
                }
            }
        )

    }
}]);

router.post('/otp/verify', [passport.authenticate('bearer', {session: false}), function (req, res) {
    //TODO also check if OTP has expired
    var responseObj = {}
    var inputOtp = req.body.otp
    var userId = req.user.results[0].value.id;
    var usersOtp = req.user.results[0].value.otp;
    var payload = {
        'phoneNumberVerified': true
    }

    if (usersOtp == inputOtp) {
        db.merge('users', userId, payload)
            .then(function (result) {
                responseObj["data"] = payload
                res.status(200);
                res.json(responseObj);
            })
            .fail(function (err) {
                customUtils.sendErrors([err.body.message], 503)
            })
    } else {
        customUtils.sendErrors(["The OTP entered does not match."], 422)
    }
}]);

/**
 * Returns User Profile for the specified email
 * Otherwise returns Profile of Logged In User
 */
router.get('/', function (req, res, next) {
    if (req.query.access_token) next();
    else next('route');
}, [passport.authenticate('bearer', {session: false}), function (req, res) {

    if (!req.query.limit || req.query.limit < 0) req.query.limit = 10;
    if (!req.query.page || req.query.page < 1) req.query.page = 1;
    var limit = req.query.limit;
    var offset = (limit * (req.query.page - 1));
    var responseObj = {};
    var query_user = req.query.userId;
    var allowUpdate;

    var getUserInfo = function (userId, allowUpdate) {
        db.get('users', userId)
            .then(function (user) {
                user.body.password = undefined
                responseObj["data"] = user.body
                responseObj["allowUpdate"] = allowUpdate
                res.status(200)
                res.json(responseObj)
            })
            .fail(function (err) {
                customUtils.sendErrors([err.body.message], 503)
            });
    }

    if (validator.isNull(query_user)) {
        customUtils.sendErrors(["Please specify the User ID"], 422)
        return
    } else {
        if (query_user == req.user.results[0].value.id)
            allowUpdate = true;
        else
            allowUpdate = false;

        getUserInfo(query_user, allowUpdate)
    }

}]);


router.get('/', function (req, res) {

    if (!req.query.limit || req.query.limit < 0) req.query.limit = 10;
    if (!req.query.page || req.query.page < 1) req.query.page = 1;
    var limit = req.query.limit;
    var offset = (limit * (req.query.page - 1));
    var responseObj = {};
    var query_user = req.query.userId;
    var allowUpdate;

    var getUserInfo = function (userId, allowUpdate) {
        db.get('users', userId)
            .then(function (user) {
                user.body.password = undefined
                responseObj["data"] = user.body
                responseObj["allowUpdate"] = allowUpdate
                res.status(200)
                res.json(responseObj)
            })
            .fail(function (err) {
                customUtils.sendErrors([err.body.message], 503)
            });
    }

    if (validator.isNull(query_user)) {
        customUtils.sendErrors(["Please specify the User ID"], 422)
        return
    } else {
        allowUpdate = false;
        getUserInfo(query_user, allowUpdate)
    }

});

router.patch('/', [passport.authenticate('bearer', {session: false}), multer(), function (req, res) {

    if (Object.keys(req.body).length === 0 && Object.keys(req.files).length === 0) {
        res.status(422);
        res.json({"errors": ["No key was sent in the body"]});
        return;
    }

    var responseObj = {};
    var userId = req.user.results[0].value.id;
    var filetype;
    var reqBody = req.body;
    var errors = new Array();

    // Dummy Promise that always resolves :D
    var promise = kew.resolve({
        "body": {
            "total_count": 0
        }
    });


    if (!validator.isNull(reqBody.location_name)) {
        if (!validator.isDecimal(reqBody.lat))
            errors.push("Invalid Lattitude value");
        else
            reqBody.lat = parseFloat(reqBody.lat)
        if (!validator.isDecimal(reqBody.long))
            errors.push("Invalid Longitude value");
        else
            reqBody.long = parseFloat(reqBody.long)
    }

    if (!validator.isNull(reqBody.name))
        if (!reqBody.name.match(/\w*/g)) errors.push("Name contains illegal characters");

    if (!validator.isNull(reqBody.userDesc))
        if (!validator.isLength(req.body.userDesc, 20)) errors.push("Description must be greater than 20 characters");

    if (!validator.isNull(req.files.avatar))
        if (!validator.isImage(req.files.avatar.mimetype)) errors.push("Avatar should be an image type");

    if (!validator.isNull(reqBody.email)) {
        if (!validator.isEmail(reqBody.email)) {
            errors.push("No Account with the entered email exists");
        } else {
            var errMsg = "Email ID already registered. Please register with a new one.";
            var promise = db.newSearchBuilder()
                .collection('users')
                .query('value.email:`' + reqBody.email + '`')
        }
    }

    if (!validator.isNull(reqBody.username)) {
        if (!validator.isLength(reqBody.username, 6, 20)) {
            errors.push("Username must be between 6-20 characters");
        } else if (!reqBody.username.match(/^[a-zA-Z0-9_]*$/)) {
            errors.push("Username must contain only alphabets, numbers or underscore")
        } else {
            var errMsg = "Username already in use. Please enter a new one.";
            var promise = db.newSearchBuilder()
                .collection('users')
                .query('value.username:`' + reqBody.username + '`')
        }
    }

    kew.all([promise])
        .then(function (content) {
            if (content[0].body.total_count > 0) {
                errors.push(errMsg);
            }
            if (errors.length > 0) {
                customUtils.sendErrors(errors, 422)
            } else {
                customUtils.upload(req.files.avatar, function (avatarInfo) {
                    if (req.files.avatar) {
                        var payload = {
                            "avatar": avatarInfo.url,
                            "avatarThumb": avatarInfo.urlThumb,
                            "userDesc": req.body.userDesc,
                            "tagline": req.body.tagline,
                            "name": req.body.name,
                            "username": req.body.username,
                            "gcmId": req.body.gcmId,
                            "location_name": reqBody.location_name,
                            "location": {
                                "lat": reqBody.lat,
                                "long": reqBody.long
                            }
                        };
                    } else if (reqBody.email) {
                        var newToken = customUtils.generateToken();
                        var payload = {
                            "email": req.body.email,
                            "isVerified": newToken,
                            "username": req.body.username,
                            "location_name": reqBody.location_name,
                            "location": {
                                "lat": reqBody.lat,
                                "long": reqBody.long
                            }
                        };
                    } else if (req.body.avatar == 'null') {
                        var payload = {
                            "avatar": "https://s3-ap-southeast-1.amazonaws.com/playable-prod/default_profile_photo-1.png",
                            "avatarThumb": "https://s3-ap-southeast-1.amazonaws.com/playable-prod/default_profile_photo-1.png"
                        }
                    } else {
                        var payload = {
                            "userDesc": req.body.userDesc,
                            "tagline": req.body.tagline,
                            "name": req.body.name,
                            "username": req.body.username,
                            "gcmId": req.body.gcmId,
                            "location_name": reqBody.location_name,
                            "location": {
                                "lat": reqBody.lat,
                                "long": reqBody.long
                            }
                        };
                    }

                    db.merge('users', userId, payload)
                        .then(function (result) {
                            responseObj["data"] = payload;
                            res.status(200);
                            res.json(responseObj);
                        })
                        .fail(function (err) {
                            customUtils.sendErrors([err.body.message], 503)
                        });
                });
            }
        })
        .fail(function (err) {
            customUtils.sendErrors([err.body.message], 503)
        })
}]);

router.post('/forgotPassword', function (req, res) {
    var email = req.body.email;
    db.newSearchBuilder()
        .collection('users')
        .query('value.email:`' + email + '`')
        .then(function (users) {
            if (users.body.total_count == 1) {
                var userObj = _.cloneDeep(users.body.results[0].value);
                var newPass = customUtils.generateToken(4);
                var hashedPassword = bcrypt.hashSync(newPass, 8);
                db.merge('users', userObj.id, {
                    "password": hashedPassword
                })
                    .then(function (result) {
                        res.json({
                            "data": {
                                "success": "Please check your Email for the new password"
                            }
                        });
                        var msg = "Hello!\nYour new password for Playable is : " + newPass + "\n\nKindly note that this is a system generated password and we strongly recommend that you change your password once you login using this.\n\nLooking forward to providing you a great playing experience on Playable.\n\nRegards,\nPlayable Team";
                        var subject = 'Request for New Password'
                        sendEmail(userObj.email, subject, msg)
                    })
            } else {
                res.status(422);
                res.json({"errors": ["This email ID is not registered with us. Please enter the registered email ID"]});
            }
        })
        .fail(function (err) {
            res.status(503);
            res.json({"errors": [err.body.message]});
        })
});

router.patch('/password', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var responseObj = {};
    var userId = req.user.results[0].value.id;
    var reqBody = req.body;
    var errors = new Array();

    if (!validator.isLength(reqBody.newPass, 8, 20)) errors.push("Password must be between 8-20 characters");
    if (!validator.isNull(reqBody.currPass)) {
        if (reqBody.newPass != reqBody.rePass) {
            errors.push("Passwords don't match!");
        } else {
            var hash = req.user.results[0].value.password;
            if (!bcrypt.compareSync(reqBody.currPass, hash)) {
                errors.push("Entered password does not match your current password");
            }
        }
    }

    if (errors.length > 0) {
        customUtils.sendErrors(errors, 422)
    } else {
        var hashedPassword = bcrypt.hashSync(req.body.newPass, 8);
        var payload = {
            "password": hashedPassword
        }

        db.merge('users', userId, payload)
            .then(function (result) {
                db.newSearchBuilder()
                    .collection('tokens')
                    .limit(100)
                    .query('value.user:`' + userId + '`')
                    .then(function (result) {
                        result.body.results.forEach(function (token) {
                            db.remove('tokens', token.path.key, true)
                                .then(function (result) {
                                    console.log("deleted token")
                                })
                        })
                    })
                res.json({
                    "data": {
                        "success": "Password changed. Please login again"
                    }
                });
            })
            .fail(function (err) {
                customUtils.sendErrors([err.body.message], 503)
            });
    }

}]);

router.get('/connections', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var userId = req.user.results[0].value.id;
    var removeMatchInvitees = false
    var matchPlayers = []
    var responseObj = {}

    db.newGraphReader()
        .get()
        .from('users', userId)
        .related('connections')
        .then(function (userResults) {
            if (req.query.matchId) {
                /**
                 * the query has a matchId
                 * remove the already invited participants in that match from that list
                 */
                db.newGraphReader()
                    .get()
                    .from('matches', req.query.matchId)
                    .related('invitees')
                    .then(function (inviteeResults) {

                        var inviteeResultsId = inviteeResults.map(function (inviteeResult) {
                            return inviteeResult.path.key
                        })

                        var filteredConnections = []
                        userResults.forEach(function (userResult) {
                            if (!(inviteeResultsId[userResult.path.key] > -1))
                                filteredConnections.push(userResult)
                        })
                        responseObj["data"] = customUtils.injectId(filteredConnections)
                        res.status(200)
                        res.json(responseObj)
                    })
                    .fail(function (err) {
                        responseObj["data"] = customUtils.injectId(userResults)
                        res.status(200)
                        res.json(responseObj)
                    })
            } else {
                responseObj["data"] = customUtils.injectId(userResults)
                res.status(200)
                res.json(responseObj)
            }
        })
        .fail(function (err) {
            customUtils.sendErrors([err.body.message], 503)
        })
}])

router.get('/discover', [passport.authenticate('bearer', {session: false}), function (req, res) {
    var queries = new Array();
    var responseObj = {}

    var isDistanceQuery = false;
    if (req.query.lat && req.query.long && req.query.radius) {
        console.log("we have a distance query")
        queries.push(customUtils.createDistanceQuery(req.query.lat, req.query.long, req.query.radius))
        isDistanceQuery = true;
    }

    if (req.query.sports) {
        console.log("we have a sports filter")
        var sportsArray = req.query.sports.split(',');
        queries.push(customUtils.createSportsQuery(sportsArray))
    }

    var theFinalQuery = customUtils.queryJoiner(queries)
    console.log("The final query")
    console.log(theFinalQuery)

    /**
     * remove sort by location if query does not have
     * location
     */
    if (isDistanceQuery) {
        db.newSearchBuilder()
            .collection("users")
            .sort('location', 'distance:asc')
            .query(theFinalQuery)
            .then(function (results) {
                responseObj["total_count"] = results.body.total_count
                responseObj["data"] = customUtils.injectId(results)
                res.status(200)
                res.json(responseObj)
            })
            .fail(function (err) {
                customUtils.sendErrors([err.body.message], 503)
            })
    } else {
        db.newSearchBuilder()
            .collection("users")
            //.sort('location', 'distance:asc')
            .query(theFinalQuery)
            .then(function (results) {
                responseObj["total_count"] = results.body.total_count
                responseObj["data"] = customUtils.injectId(results)
                res.status(200)
                res.json(responseObj)
            })
            .fail(function (err) {
                customUtils.sendErrors([err.body.message], 503)
            })
    }
}])

var signUpFreshGoogleUser = function (payload, avatar, avatarThumb, res) {
    var responseObj = {};
    var id = customUtils.generateToken(8)
    var date = new Date();

    //ensure max length is 12 chars
    var generatedUsername = payload['name'].split(" ")[0].toLowerCase().substring(0, 7) + "_" + customUtils.generateToken(2);

    //use a dummyPassword to throw "incorrect password"
    //error just in case someone tries to normal login
    //can't keep password field undefined
    var user = {
        "id": id,
        "gcmId": undefined,
        "name": payload['name'],
        "username": generatedUsername,
        "email": payload['email'],
        "password": "dummyPassword",
        "avatar": avatar,
        "avatarThumb": avatarThumb,
        "userDesc": undefined,
        "tagline": undefined,
        "isVerified": true,
        "phoneNumberVerified": false,
        "last_seen": date.getTime(),
        "google": payload['sub'],
        "created": date.getTime(),
        "cover": constants.cover
    };

    qbchat.createUser({
        login: user.username,
        email: user.email,
        password: config.qb.defaultPassword,
        full_name: user.name,
        custom_data: user.avatar
    }, function (err, newUser) {
        if (err) {
            responseObj["errors"] = err;
            res.status(409);
            res.json(responseObj);
        } else {
            user["qbId"] = newUser.id;
            db.put('users', id, user)
                .then(function (result) {
                    var date = new Date();
                    var chatObj = {
                        "type": "newUser",
                        "username": user['username'],
                        "qbId": user['qbId'],
                        "dbId": user['id'],
                        "created": date.getTime(),
                        "id": date.getTime()
                    }
                    if (typeof user['gcmId'] !== 'undefined')
                        chatObj['gcmId'] = user['gcmId']
                    else
                        chatObj['gcmId'] = 'undefined'

                    notify.emit("wordForChat", chatObj)

                    user['password'] = undefined;

                    var notifObj = {
                        user: id,
                        name: user.name
                    };
                    notify.emit('welcome', notifObj)
                })
                .then(function () {
                    var accessToken = customUtils.generateToken();
                    var userId = user.id;
                    db.put('tokens', accessToken, {
                        "user": userId
                    })
                        .then(function (result) {
                            db.newGraphBuilder()
                                .create()
                                .from('tokens', accessToken)
                                .related('hasUser')
                                .to('users', userId)
                                .then(function (result) {
                                    user["access_token"] = accessToken;
                                    responseObj["data"] = user;
                                    //prompt the user to change his randomly generated username
                                    responseObj["data"]["changeUsername"] = true;
                                    res.status(201);
                                    res.json(responseObj);
                                })
                        })
                })
                .fail(function (err) {
                    console.log("POST FAIL:" + err);
                    responseObj["errors"] = [err.body.message];
                    res.status(503);
                    res.json(responseObj);
                });
        }
    })
};

var signUpFreshFacebookUser = function (payload, avatar, avatarThumb, res, changeEmail, accessToken) {
    var responseObj = {};
    var id = customUtils.generateToken(8)
    var date = new Date();

    //ensure max length is 12 chars
    var generatedUsername = payload['name'].split(" ")[0].toLowerCase().substring(0, 7) + "_" + customUtils.generateToken(2);

    //use a dummyPassword to throw "incorrect password"
    //error just in case someone tries to normal login
    //can't keep password field undefined
    var user = {
        "id": id,
        "gcmId": undefined,
        "name": payload['name'],
        "username": generatedUsername,
        "email": payload['email'],
        "password": "dummyPassword",
        "avatar": avatar,
        "avatarThumb": avatarThumb,
        "userDesc": undefined,
        "tagline": undefined,
        "phoneNumberVerified": false,
        "isVerified": true,
        "last_seen": date.getTime(),
        "facebook": payload['id'],
        "created": date.getTime(),
        "cover": payload['cover']
    };

    qbchat.createUser({
        login: user.username,
        email: user.email,
        password: config.qb.defaultPassword,
        full_name: user.name,
        custom_data: user.avatar
    }, function (err, newUser) {
        if (err) {
            responseObj["errors"] = err;
            res.status(409);
            res.json(responseObj);
        } else {
            user["qbId"] = newUser.id;
            db.put('users', id, user)
                .then(function (result) {
                    //---------------merge facebook friends ------------------------
                    extractFacebookFriends(id, accessToken)
                    //---------------merge facebook friends end --------------------
                    //var urlLink = "http://api2.pyoopil.com:3000/user/verify?user=" + id + "&token=" + isVerified;
                    //var msg = "Hello" + user.name + ",\n Thank you for signing up with Pyoopil. Kindly verify your email by clicking on the following link. This shall help us serve you better. \n " + urlLink + " \nLooking forward to providing you a great learning experience on Pyoopil.\n\nRegards,\nPyoopil Team";
                    //var subject = 'Welcome to Pyoopil - Email Verification';
                    //sendEmail(user.email, subject, msg);
                    var date = new Date();
                    var chatObj = {
                        "type": "newUser",
                        "username": user['username'],
                        "qbId": user['qbId'],
                        "dbId": user['id'],
                        "created": date.getTime(),
                        "id": date.getTime()
                    }
                    if (typeof user['gcmId'] !== 'undefined')
                        chatObj['gcmId'] = user['gcmId']
                    else
                        chatObj['gcmId'] = 'undefined'

                    notify.emit("wordForChat", chatObj)

                    user['password'] = undefined;

                    var notifObj = {
                        user: id,
                        name: user.name
                    };
                    notify.emit('welcome', notifObj)
                })
                .then(function () {
                    var accessToken = customUtils.generateToken();
                    var userId = user.id;
                    db.put('tokens', accessToken, {
                        "user": userId
                    })
                        .then(function (result) {
                            db.newGraphBuilder()
                                .create()
                                .from('tokens', accessToken)
                                .related('hasUser')
                                .to('users', userId)
                                .then(function (result) {
                                    user["access_token"] = accessToken;
                                    responseObj["data"] = user;
                                    //prompt the user to change his randomly generated username
                                    responseObj["data"]["changeUsername"] = true;
                                    responseObj["data"]["changeEmail"] = changeEmail;
                                    res.status(201);
                                    res.json(responseObj);
                                })
                        })
                })
                .fail(function (err) {
                    console.log("POST FAIL:" + err);
                    responseObj["errors"] = [err.body.message];
                    res.status(503);
                    res.json(responseObj);
                });
        }
    })
};

var generateTokenAndLogin = function (user, res) {
    var responseObj = {};
    var accessToken = customUtils.generateToken();
    var userId = user.body.results[0].value.id;

    db.put('tokens', accessToken, {
        "user": userId
    })
        .then(function (result) {
            db.newGraphBuilder()
                .create()
                .from('tokens', accessToken)
                .related('hasUser')
                .to('users', userId)
                .then(function (result) {
                    responseObj["data"] = user.body.results[0].value;
                    responseObj["data"]["access_token"] = accessToken;
                    res.status(201);
                    res.json(responseObj);
                })
        })
};

module.exports = router;