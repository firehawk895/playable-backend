var express = require('express');
var router = express.Router();

var passport = require('passport');
var multer = require('multer');
var fs = require('fs');


var config = require('../config.js');
var async = require('async')

//kardo sab import, node only uses it once
var config = require(__base + 'config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require(__base + 'utils.js');
var constants = require(__base + 'constants');
var qbchat = require(__base + 'Chat/qbchat');
var UserModel = require(__base + 'models/User');
var MatchModel = require(__base + 'models/Match');
var EventModel = require(__base + 'models/Event');
var RequestModel = require(__base + 'requests/Request');
var dbUtils = require(__base + 'dbUtils');
var EventSystem = require(__base + 'events/events');

router.get('/', function (req, res) {
    var responseObj = {}
    db.search('sports', '*', {
        limit: 100,
        offset: 0
    })
        .then(function (result) {
            responseObj["data"] = dbUtils.injectId(result)
            res.status(200)
            res.json(responseObj)
        })
        .fail(function (err) {
            responseObj["errors"] = [err.body.message];
            res.status(503);
            res.json(responseObj);
        })
})

module.exports = router