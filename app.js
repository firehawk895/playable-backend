var express = require('express');
var path = require('path');
var fs = require('fs')
var morgan = require('morgan');
var bodyParser = require('body-parser');
var cors = require('cors');
var request = require('request')

var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy;

var user = require('./routes/user');

var config = require('./config.js');
var customUtils = require('./utils.js');

var validator = require('validator');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var app = express();

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
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/user', user);

app.all('/ping', function (req, res) {
    res.send('Pong')
});

app.post('/util/link', function (req, res) {
    if (!validator.isURL(req.body.url)) {
        res.status(422);
        res.json({"errors": ["URL must be valid"]});
    } else {
        customUtils.getLinkInfo(req.body.url, function (info) {
            info["video"] = req.body.url;
            res.json({"data": info});
        })
    }
});

app.get('/preview', function (req, res) {
    var theRequest = "http://collex.io/c/get_site_content/?url=" + req.query.url
    console.log(theRequest)
    request(theRequest, function (err, response, body) {
        res.send(JSON.parse(body))
    })
})

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
    res.status(err.status || 500);
    res.json({
        message: err.message,
        error: err
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
