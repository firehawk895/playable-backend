var config = require('./config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var dbUtils = require('./dbUtils');
var constants = require('./constants');

//var customUtils = require('./utils');
//var request = require('request')

var sportsArray = [
    {
        "name" : "badminton",
        "displayName": "Badminton",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_badminton_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_badminton_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_badminton_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_badminton_cover_3.png"
        ]
    },
    {
        "name" : "basketball",
        "displayName": "Basketball",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_basketball_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_basketball_cover_1",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_basketball_cover_2",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_basketball_cover_3"
        ]
    },
    {
        "name" : "bowling",
        "displayName": "Bowling",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_bowling_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_bowling_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_bowling_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_bowling_cover_3.png"
        ]
    },
    {
        "name" : "cricket",
        "displayName": "Cricket",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_cricket_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_cricket_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_cricket_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_cricket_cover_3.png"
        ]
    },
    {
        "name" : "cycling",
        "displayName": "Cycling",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_cycling_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_cycling_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_cycling_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_cycling_cover_3.png"
        ]
    },
    {
        "name" : "football",
        "displayName": "Football",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_football_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_football_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_football_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_football_cover_3.png"
        ]
    },
    {
        "name" : "golf",
        "displayName": "Golf",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_golf_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_golf_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_golf_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_golf_cover_3.png"
        ]
    },
    {
        "name" : "hockey",
        "displayName": "Hockey",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_hockey_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_hockey_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_hockey_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_hockey_cover_3.png"
        ]
    },
    {
        "name" : "pool",
        "displayName": "Pool",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_pool_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_pool_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_pool_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_pool_cover_3.png"
        ]
    },
    {
        "name" : "running",
        "displayName": "Running",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_running_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_running_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_running_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_running_cover_3.png"
        ]
    },
    {
        "name" : "snooker",
        "displayName": "Snooker",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_snooker_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_snooker_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_snooker_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_snooker_cover_3.png"
        ]
    },
    {
        "name" : "squash",
        "displayName": "Squash",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_squash_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_squash_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_squash_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_squash_cover_3.png"
        ]
    },
    {
        "name" : "swimming",
        "displayName": "Swimming",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_swimming_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_swimming_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_swimming_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_swimming_cover_3.png"
        ]
    },
    {
        "name" : "tennis",
        "displayName": "Tennis",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_tennis_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_tennis_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_tennis_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_tennis_cover_3.png"
        ]
    },
    {
        "name" : "tt",
        "displayName": "Table Tennis",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_tt_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_tt_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_tt_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_tt_cover_3.png"
        ]
    },
    {
        "name" : "ultimatefrisbee",
        "displayName": "Ultimate Frisbee",
        "url" : "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_ultimatefrisbee_small.png",
        "cover": [
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_ultimatefrisbee_cover_1.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_ultimatefrisbee_cover_2.png",
            "https://s3-ap-southeast-1.amazonaws.com/playable-prod/ic_ultimatefrisbee_cover_3.png"
        ]
    }
]

db.newGraphReader()
    .get()
    .limit(100)
    .offset(0)
    .from('users', userId)
    .related(constants.graphRelations.users.playsMatches)
    .then(function (results) {
        var matchHistory = dbUtils.injectId(results)
        console.log(results.body)
        console.log(matchHistory)
        // responseObj["data"] = matchHistory
        // res.status(200)
        // res.json(responseObj)
    })

// sportsArray.forEach(function(sport) {
//     db.post("sports", sport)
// })