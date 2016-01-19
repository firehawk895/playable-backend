var express = require('express');
var router = express.Router();

var passport = require('passport');
var multer = require('multer');
var fs = require('fs');
customUtils = require('../utils.js');

var config = require('../config.js');
var async = require('async')
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

router.get('/', function (req, res) {
    var responseObj = {}
    db.search('sports', '*', {
        limit: 100,
        offset: 0
    })
        .then(function (result) {
            responseObj["data"] = customUtils.injectId(result)
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