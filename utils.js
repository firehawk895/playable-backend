var config = require('./config.js');

var crypto = require('crypto');
var randomString = require('random-string');

var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);

var fs = require('fs'),
    S3FS = require('s3fs'),
    s3fsImpl = new S3FS(config.s3.bucket, {
        accessKeyId: config.s3.access,
        secretAccessKey: config.s3.secret
    });

/**
 * Gets information from the given URL
 * @param  {string} url
 * @return {json}
 */
function getLinkInfo(url, callback) {
    var MetaInspector = require('minimal-metainspector');
    var client = new MetaInspector(url, {});

    if(url != undefined) {
        client.on("fetch", function () {
            var info = {
                "title": client.title,
                "desc": client.description,
                "image": client.image
            };
            callback(info);
        });

        client.on("error", function (err) {
            callback(err);
        });

        client.fetch();
    } else {
        callback(undefined);
    }
}

/**
 * Uploads file to S3
 * @param {file} file
 * @param {function} callback
 */
function upload(file, callback) {
    if(file != undefined) {
        var stream = fs.createReadStream(file.path);
        var randomString = generateToken(3)
        var originalname = file.originalname.replace(/[^\w.]/g, '_')
        var extension = originalname.match(/(\.[^.]+$)/)[0]
        var fileNameOnly = originalname.replace(/(\.[^.]+$)/, '')
        var filename = fileNameOnly + '_' + randomString + extension
        var thumb_filename = fileNameOnly + '_' + randomString + '.png'
        s3fsImpl.writeFile(filename, stream).then(function (data) {
            fs.unlink(file.path, function (err) {
                if (err) {
                    callback(err);
                }
                var info = {
                    url: "https://s3.amazonaws.com/" + config.s3.bucket + "/" + filename,
                    urlThumb: "https://s3.amazonaws.com/" + config.s3.bucket + "resized/resized-" + thumb_filename
                }
                callback(info);
            });
        });
    } else {
        callback(undefined);
    }

}


/**
 * Generate an access token for login
 * refer http://stackoverflow.com/questions/8855687/secure-random-token-in-node-js
 * can update to base64 if needed
 * @returns {string|*} access token
 */
function generateToken(length) {
    if(length)
        return crypto.randomBytes(length).toString('hex');
    else
        return crypto.randomBytes(16).toString('hex');
}


/**
 * Generate unique key for concept and conceptObjects
 * @returns {string|*} key
 */
function randomizer() {
    return randomString({
        length: 16,
        numeric: true,
        letters: true,
        special: false
    });
}


function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

exports.getLinkInfo = getLinkInfo;
exports.upload = upload;
exports.generateToken = generateToken;
exports.randomizer = randomizer;
exports.toTitleCase = toTitleCase;
