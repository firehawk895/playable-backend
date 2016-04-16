var express = require('express');
var router = express.Router();

var passport = require('passport');
var multer = require('multer');
var fs = require('fs');


var config = require('../config.js');
var async = require('async')

//kardo sab import, node only uses it once
var config = require('../config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require('../utils.js');
var constants = require('../constants');
var qbchat = require('../Chat/qbchat');
var UserModel = require('../models/User');
var MatchModel = require('../models/Match');
var EventModel = require('../models/Event');
var RequestModel = require('../requests/Request');
var dbUtils = require('../dbUtils');
var EventSystem = require('../events/events');

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
            customUtils.sendErrors(err, res)
        })
})

module.exports = router