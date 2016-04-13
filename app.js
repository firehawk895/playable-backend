/**
 * TODO: switch to schema based validation
 */
var express = require('express');
var path = require('path');
var fs = require('fs')
var morgan = require('morgan');
var bodyParser = require('body-parser');
var cors = require('cors');
var request = require('request')
var qbchat = require('./Chat/qbchat');

var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy;

var user = require('./routes/user');
var matches = require('./routes/matches');
var facilities = require('./routes/facilities');
var sports = require('./routes/sports');
var events = require('./routes/events');
var chats = require('./routes/chats');
var feedback = require('./routes/feedback');
var search = require('./routes/search');

var config = require('./config.js');
var customUtils = require('./utils.js');

//kardo sab import, node only uses it once
var constants = require('./constants');
var UserModel = require('./models/User');
var MatchModel = require('./models/Match');
var EventModel = require('./models/Event');
var RequestModel = require('./requests/Request');
var dbUtils = require('./dbUtils');
var EventSystem = require('./events/events');

var requests = require('./requests/requests');
//var recommendations = require('./recommendations/recommendations');

//----------------------------- Start Extended Validators --------------------------------------
var validator = require('validator');
validator.extend('isTimeInFuture', function (time) {
    console.log(time)
    if (!time)
        return false
    var date = new Date()
    var currentTime = date.getTime()
    console.log(currentTime)
    if (validator.isInt(time) && parseInt(time) > (currentTime / 1000))
        return true
    else
        return false
});

validator.extend('isValidLatLong', function (latOrLong) {
    var regex = /^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,6}/
    return latOrLong.match(regex) ? true : false
})

validator.extend('isImage', function (mimetype) {
    return mimetype.match(/^image/)
})
//---------------------------- End Extended Validators -----------------------------------------

var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var app = express();

//qbchat.init();
//qbchat.createSession(function (err, session) {
//        if (session) {
//            console.log("Quickblox Session created");
//        }
//        else if (err) console.log(err)
//    }
//);

function failure() {
    return false;
}

// app.use(favicon(__dirname + '/public/favicon.ico'));

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(__dirname + '/access.log', {flags: 'a'})
var corsOptions = {
    origin: '*',
    credentials: true
};

app.use(morgan(':remote-addr - [:date[clf]] - :method :url :status - :response-time ms', {stream: accessLogStream}))
app.use(morgan('dev'))
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(passport.initialize());

/**
 * Its better to use JWT (JSON Web Token)
 * so as to save these extra calls to the database
 * caching queries above the layer of orchestrate would be
 * the awesome way to go.
 */
passport.use(new BearerStrategy({},
    function (token, done) {
        db.newGraphReader()
            .get()
            .from('tokens', token)
            .related('hasUser')
            .then(function (result) {
                user = result.body;
                if (user.count === 1) {
                    return done(null, user);
                } else {
                    console.log("token has no user");
                    return done(null, false);
                }
                //console.log(result);
            })
            .fail(function (err) {
                console.log("Token invalid or expired");
                return done(null, false);
            });
    }
));

// view engine setup
//app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'jade');
//app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/user', user);
app.use('/matches', matches);
app.use('/facilities', facilities);
app.use('/sports', sports);
app.use('/events', events);
app.use('/chats', chats);
app.use('/feedback', feedback);
app.use('/search', search);


app.all('/ping', function (req, res) {
    res.send('Pong')
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
//// will print stacktrace
//if (app.get('env') === 'development') {
//  app.use(function (err, req, res, next) {
//    res.status(err.status || 500);
//    res.send(err);
//  });
//}
//
//// production error handler
//// no stacktraces leaked to user
//app.use(function (err, req, res, next) {
//  res.status(err.status || 500);
//  res.send(err);
//});

// error handlers

// development error handler
// will print stacktrace
//if (app.get('env') === 'development') {
app.use(function (err, req, res, next) {
    console.log(err)
    res.status(err.status || 500);
    res.json({
        errors: [err.message],
        errorObj: err
    });
});
//}

// production error handler
// no stacktraces leaked to user
//app.use(function(err, req, res, next) {
//  res.status(err.status || 500);
//  res.render('error', {
//    message: err.message,
//    error: {}
//  });
//});

module.exports = app;
