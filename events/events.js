var config = mod('config');
var constants = mod('constants')
var firebase = require('firebase')

var kew = require('kew')
var date = new Date()

/**
 * Now the question is who maintains the data format??
 * let firebase have it
 * @param event
 * @param data
 */
function emit(event, data) {
    //inject timestamp into the events
    data.timestamp = date.getTime()
    pushEvent(event, data)
}

function pushEvent(node, data) {
    var nodeRef = new firebase(config.firebase.url + "/" + node)
    nodeRef.push().set(data)
}


exports = {
    emit : emit
}