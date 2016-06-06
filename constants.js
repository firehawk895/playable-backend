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
        }
    },
    sportsCoverPics: {
        pool: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/pool_004f12.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-pool_004f12.png'
        },
        snooker: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/snooker_d1883d.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-snooker_d1883d.png'
        },
        ultimatefrisbee: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/ultimate_frisbee_d88036.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-ultimate_frisbee_d88036.png'
        },
        tt: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/table_tennis_64b262.jpeg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-table_tennis_64b262.png'
        },
        badminton: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/badminton_b5f5d4.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-badminton_b5f5d4.png'
        },
        squash: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/squash_add7e3.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-squash_add7e3.png'
        },
        tennis: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/tennis_d31ecf.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-tennis_d31ecf.png'
        },
        cycling: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/cycling_782eb2.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-cycling_782eb2.png'
        },
        swimming: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/swimming_3220c7.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-swimming_3220c7.png'
        },
        cricket: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/cricket_0bc345.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-cricket_0bc345.png'
        },
        bowling: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/bowling_68f975.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-bowling_68f975.png'
        },
        hockey: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/hockey_380b45.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-hockey_380b45.png'
        },
        running: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/running_eb253c.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-running_eb253c.png'
        },
        golf: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/golf_7e3de7.png',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-golf_7e3de7.png'
        },
        football: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/football_558676.jpg',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-football_558676.png'
        },
        basketball: {
            url: 'https://s3.amazonaws.com/pyoopil-prod-server/basketball_e04843.png',
            urlThumb: 'https://s3.amazonaws.com/pyoopil-prod-serverresized/resized-basketball_e04843.png'
        }
    }
}