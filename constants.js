module.exports = {
    sports: [
        "badminton",
        "basketball",
        "bowling",
        "cricket",
        "cycling",
        "football",
        "golf",
        "hockey",
        "pool",
        "running",
        "snooker",
        "squash",
        "swimming",
        "tennis",
        "tt",
        "ultimatefrisbee"
    ],
    //following the facebook format
    "cover": {
        "source": "https://s3-ap-southeast-1.amazonaws.com/playable-prod/default_cover_photo.jpg"
    },
    "skill_rating_min": 1,
    "skill_rating_max": 5,
    "validations": {
        "event": {
            "title_empty_message": "Event title cannot be empty",
            "sub_title_max_length": 1000,
            "sub_title_max_length_message": "Sub Title should be of maximum 100 characters",
            "description_max_length_message": "Description should be of maximum 1000 characters",
            "description_max_length": 1000,
            "time_in_future": "Event time should be valid and in the future",
            "reg_time_in_future": "Registration date end should be valid and in the future",
            "contactUs": "Enter valid contact us details",
            "priceText": "Enter a description of the price --> 2000Rs for the team",
            //event mey toh hai hee nahi
            //"slot_min_message": "An event must have more than 1 slot",
            //"slot_min": 2,
            "invalid_url": "Please enter a valid URL (possibly a google form) for the event",
            "cover_photo_invalid": "Please upload a valid image for the cover photo",
            "isPaid_boolean_message": "isPaid must be true/false",
            "price_invalid_message": "Please enter a valid price of the event",
            "price_text_null": "Please enter a valid price of the event"
        },
        "is_not_image_message": "The file uploaded is not an image",
        "invalid_sport_type": "The sport entered is an invalid type",
        "invalid_lat_message": "The Latitude value is invalid",
        "invalid_long_message": "The Longitude value is invalid",
        "invalid_skill_rating_range_message": "The skill level must be a valid integer range"
    },
    "firebaseNodes": {
        "recommendations": "recommendations",
        "requests": "requests",
        "events" : {
            "newMatches": "events/matches"
        },
        notifications : "notifications"
    },
    requests: {
        type: {
            connect: "connectRequest",
            match: "OneOnOneMatchRequest",
            invite: "inviteToMatchRequest",
            join: "joinMatchRequest"
        },
        status: {
            accepted: "accepted",
            rejected: "rejected",
            pending: "pending"
        }
    },
    "recommendations": {
        rating: {
            "thumbsUp": "thumbsUp",
            "thumbsDown": "thumbsDown",
            "notPlayed": "notPlayed"
        },
        type: {
            OneOnOne: "OneOnOne",
            facility: "facility",
            team: "team"
        }
    },
    graphRelations: {
        matches: {
            hostedFacility: 'hostedFacility',
            participants: 'participants',
            isHostedByUser: 'isHosted',
            invitedUsers : 'invitees'
        },
        facilities: {
            hasMatches: 'hasMatches'
        },
        users: {
            connections: "connections",
            playsMatches: 'plays',
            hostsMatch: 'hosts',
            requestedToConnect: "requestedToConnect",
            waitingToAccept: "waitingToAccept",
            invitedToMatch : "invited"
        },
        events: {
            participants : "participants"
        }
    },
    connections: {
        status: {
            none: "none",
            connected: "connected",
            requestedToConnect: "requestedToConnect",
            waitingToAccept: "waitingToAccept"
        }
    },
    events: {
        matches : {
            created : "events/matches/created"
        },
        users : {
            created : "events/users/created"
        },
        events : {
            created : "events/events/created",
            userBooked : "events/events/userBooked"
        },
        requests : {
            sent : {
                connect : "events/requests/sent/connect",
                fixAmatch : "events/requests/sent/fixAmatch",
                inviteToMatch : "events/requests/sent/inviteToMatch"
            },
            accepted : {
                connect : "events/requests/sent/connect",
                fixAmatch : "events/requests/sent/fixAmatch",
                inviteToMatch : "events/requests/sent/inviteToMatch"
            }
        },
        chats : {
            message : "events/chats/message"
        },
        timestampkey : "eventTimeStamp"
    },
    /**
     * These constants are injected into the
     * chat room's name so the chatdialog can be identified
     */
    chats: {
        oneOnOne: '<oneOnOneRoom>',
        matchRoom: '<matchRoom>'
    },
    db : {
        limit : 100
    },
    notifications : {
        path: "/notifications",
        type: {
            inApp: "app",
            push: "push",
            both: "both",
        }
    }
}