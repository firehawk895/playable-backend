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
        "tabletennis",
        "ultimatefrisbee"
    ],
    //following the facebook format
    "cover": {
        "source": "https://s3.amazonaws.com/pyoopil-prod-serverresized/playable-cover.png"
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
        "events": {
            "newMatches": "events/matches"
        },
        notifications: "notifications"
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
            invitedUsers: 'invitees'
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
            invitedToMatch: "invited"
        },
        events: {
            participants: "participants"
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
        matches: {
            created: "events/matches/created"
        },
        users: {
            created: "events/users/created"
        },
        events: {
            created: "events/events/created",
            userBooked: "events/events/userBooked"
        },
        requests: {
            sent: {
                connect: "events/requests/sent/connect",
                fixAmatch: "events/requests/sent/fixAmatch",
                inviteToMatch: "events/requests/sent/inviteToMatch"
            },
            accepted: {
                connect: "events/requests/sent/connect",
                fixAmatch: "events/requests/sent/fixAmatch",
                inviteToMatch: "events/requests/sent/inviteToMatch"
            }
        },
        chats: {
            message: "events/chats/message"
        },
        timestampkey: "eventTimeStamp"
    },
    /**
     * These constants are injected into the
     * chat room's name so the chatdialog can be identified
     */
    chats: {
        oneOnOne: '<oneOnOneRoom>',
        matchRoom: '<matchRoom>'
    },
    db: {
        limit: 100
    },
    notifications: {
        path: "/notifications",
        type: {
            inApp: "app",
            push: "push",
            both: "both",
        },
        links: {
            discover: 'discover',
            eventId: 'eventId',
            matchId: 'matchId',
            request: 'request',
            userId: 'userId'
        }
    },
    sportsCoverPics: {
        pool: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/pool_004f12.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-pool_004f12.png'
        },
        snooker: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/snooker_12_49080e.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-snooker_12_49080e.png'
        },
        ultimatefrisbee: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/ultimate_12_1d3713.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-ultimate_12_1d3713.png'
        },
        tabletennis: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/table_tennis_64b262.jpeg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-table_tennis_64b262.png'
        },
        badminton: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/badminton_16d145.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-badminton_16d145.png'
        },
        squash: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/squash_add7e3.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-squash_add7e3.png'
        },
        tennis: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/tennis_12_f38820.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-tennis_12_f38820.png'
        },
        cycling: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/cycling_782eb2.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-cycling_782eb2.png'
        },
        swimming: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/swimming_12_cda533.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-swimming_12_cda533.png'
        },
        cricket: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/cricket_12_ff52ef.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-cricket_12_ff52ef.png'
        },
        bowling: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/bowling_68f975.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-bowling_68f975.png'
        },
        hockey: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/hockey_12_f05c29.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-hockey_12_f05c29.png'
        },
        running: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/running_12_c43383.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-running_12_c43383.png'
        },
        golf: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/golf_12_2c68d1.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-golf_12_2c68d1.png'
        },
        football: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/football_763658.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-football_763658.png'
        }
        ,
        basketball: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/basketball_399b89.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-basketball_399b89.png'
        }
    }
}