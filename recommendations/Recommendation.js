


/**
 * creates cron jobs that will create recommendations
 * for the participants of the match
 * @param matchId
 * @param playing_time
 */
function createRecommendationCron(matchId, playing_time) {
    //create new cron for the playing_time + constants.recommendation.dispatchTime
    //get all match participants
    //create recommendation objects for each user in firebase
    var matchPromise = getMatchPromise(matchId)
    var participantsPromise = getMatchParticipantsPromise(matchId)

    kew.all([matchPromise, participantsPromise])
        .then(function (results) {
            var match = results[0]
            var participants = results[1]
            if (match.body.slots_filled == 2) {
                //1 on 1 match
                var participant1 = participants.results.body[0];
                var participant2 = participants.results.body[1];
                createRateYourOpponentReco(participant1.key, participant2.key, participant2.value.name)
                createRateYourOpponentReco(participant2.key, participant1.key, participant1.value.name)
            } else {
                //team match (more than 2 players)
                participants.results.body.forEach(function (participant) {
                    createRateTeamReco(participant.key, matchId, match.title)
                })
            }
            if (match.isFacility) {
                getFacilityOfMatchPromise
                    .then(function (result) {
                        var facilityId = result.body.results[0].path.key
                        var facility = result.body.results[0].path.value
                        participants.results.body.forEach(function (participant) {
                            createRateFacilityReco(participant.key, facilityId, facility)
                        })
                    })
            }
        })
}

function createRateYourOpponentReco(fromUserId, toUserId, toUserName) {
    var payload = {
        'type': constants.recommendations.type.OneOnOne, //the type of Recommendation rating
        'message': 'Rate your opponent! Would you like to play with ' + toUserName + " again?",
        'isRated': false, //set to true once user has rated this
        'rating': constants.recommendations.rating.notPlayed, //front End will switch this to "thumbsUp" or "thumbsDown",
        fromUserId: fromUserId,
        'toUserId': toUserId
    }
    pushRecoToFirebase(payload, fromUserId)
}

function parseOneOnOneReco(recoObj) {
    rateUser(recoObj.rating, recoObj.toUserId)
    incrementMatchesPlayed(recoObj.fromUserId)
}

function createRateFacilityReco(fromUserId, toFacilityId, facilityName) {
    var payload = {
        'type': constants.recommendations.type.facility, //the type of Recommendation rating
        'message': 'How would you like to rate the facility ' + facilityName + "?",
        'isRated': false, //set to true once user has rated this
        'rating': constants.recommendations.rating.notPlayed, //front End will switch this to "thumbsUp" or "thumbsDown" or "notPlayed",
        fromUserId: fromUserId,
        toFacilityId: toFacilityId
    }
    pushRecoToFirebase(payload, fromUserId)
}

function parseFacilityReco(recoObj) {
    rateFacility(recoObj.rating, recoObj.toFacilityId)
}

function createRateTeamReco(fromUserId, toMatchId, toMatchName) {
    var payload = {
        'type': constants.recommendations.type.team, //the type of Recommendation rating
        'message': 'Rate the match "' + toMatchName + '"! Would you play with this team again?',
        'isRated': false, //set to true once user has rated this
        'rating': constants.recommendations.rating.notPlayed, //front End will switch this to "thumbsUp" or "thumbsDown" or "notPlayed",
        'toMatchId': toMatchId,
        'fromUserId': fromUserId
    }
    pushRecoToFirebase(payload, fromUserId)
}

function parseTeamReco(recoObj) {
    getMatchParticipantsPromise(recoObj.toMatchId)
        .then(function (results) {
            var participantIds = results.body.results.map(function (aResult) {
                return aResult.path.key
            })

            //If you've rated, you've played
            //because, you know, users are honest :)
            if (recoObj.rating != constants.recommendations.rating.notPlayed) {
                incrementMatchesPlayed(recoObj.fromUserId)
            }
            participantIds.splice(recoObj.fromUserId, 1)
            participantIds.forEach(function (participantId) {
                rateUser(recoObj.rating, participantId)
            })
        })
}

/**
 * Parse each recommendation marked by user
 * and do the needful updates
 * @param recoObj
 */
function parseRecObject(recoObj) {
    switch (recoObj.type) {
        case constants.recommendations.type.OneOnOne:
            parseOneOnOneReco(recoObj)
            break;
        case constants.recommendations.type.facility:
            parseFacilityReco(recoObj)
            break;
        case constants.recommendations.type.team:
            parseTeamReco(recoObj)
            break;
        default:
    }
}

function rateUser(rating, userId) {
    var payload = {}
    db.get('users', userId)
        .then(function (result) {
            var totalRatings = result.body.totalRatings
            var thumbsUps = result.body.thumbsUps
            var matchesPlayed = result.body.matchesPlayed

            if (rating == constants.recommendations.rating.thumbsUp) {
                payload = {
                    totalRatings: totalRatings + 1,
                    thumbsUps: thumbsUps + 1
                }
            } else if (rating == constants.recommendations.rating.thumbsDown) {
                payload = {
                    totalRatings: totalRatings + 1
                }
            }
            db.merge('users', userId, payload)
        })
}

function rateFacility(rating, facilityId) {
    var payload = {}
    getFacilityPromise(facilityId)
        .then(function (result) {
            var totalRatings = result.body.totalRatings
            var thumbsUps = result.body.thumbsUps
            var matchesPlayed = result.body.matchesPlayed

            if (rating == constants.recommendations.rating.thumbsUp) {
                payload = {
                    totalRatings: totalRatings + 1,
                    thumbsUps: thumbsUps + 1
                }
            } else if (rating == constants.recommendations.rating.thumbsDown) {
                payload = {
                    totalRatings: totalRatings + 1
                }
            }
            db.merge('facilities', facilityId, payload)
        })
}

/**
 * Push a recommendation to Firebase user tree
 * @param jsonPayload
 * @param userId
 */
function pushRecoToFirebase(jsonPayload, userId) {
    var newRecoRef = new Firebase(config.firebase.url + "/" + constants.firebaseNodes.recommendations + "/" + userId)
    newRecoRef.child("data").push().set(jsonPayload)
    newRecoRef.child("count").transaction(function (current_value) {
        return (current_value || 0) + 1;
    });
}