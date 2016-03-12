//kardo sab import, node only uses it once
var config = require(__base + './config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var customUtils = require(__base + './utils.js');
var constants = require(__base + './constants');
var qbchat = require(__base + './Chat/qbchat');
var UserModel = require(__base + './models/User');
var MatchModel = require(__base + './models/Match');
var EventModel = require(__base + './models/Event');
var RequestModel = require(__base + './requests/Request');
var EventSystem = require(__base + './events/events');

/**
 * Orchestrate query wrappers ---------------------------------->
 */
/**
 * create an orchestrate Neo4J graph connection
 * @param from
 * @param fromKey
 * @param to
 * @param toKey
 * @param relationName
 */
function createGraphRelation(from, fromKey, to, toKey, relationName) {
    db.newGraphBuilder()
        .create()
        .from(from, fromKey)
        .related(relationName)
        .to(to, toKey);
}

function createGraphRelationPromise(from, fromKey, to, toKey, relationName) {
    return db.newGraphBuilder()
        .create()
        .from(from, fromKey)
        .related(relationName)
        .to(to, toKey);
}

/**
 *
 * @param collection
 * @param id
 * @param relation
 * @returns {GraphBuilder}
 */
function getGraphResultsPromise(collection, id, relation) {
    return db.newGraphReader()
        .get()
        .from(collection, id)
        .related(relation)
}


/**
 * join a set of queries with AND, OR conditions
 * for lucene/orchestrate
 * @param queries
 * @param type
 */
function queryJoiner(queries) {
    var returnQuery = ""
    queries.forEach(function (query) {
        returnQuery += "("
        returnQuery += query
        returnQuery += ") AND "
    })
    returnQuery = returnQuery.substring(0, returnQuery.length - 5)
    return returnQuery
}

/**
 * generates a lucene OR query for a set of values (theArray)
 * for a specific key (searchKey) to search for
 * @param theArray
 * @param searchKey
 * @returns {string}
 */
function createFieldORQuery(theArray, searchKey) {
    var theQuery = searchKey + ": ("
    theArray.forEach(function (oneItem) {
        theQuery += "`" + oneItem + "` OR "
    })
    theQuery += ")"
    theQuery = theQuery.substring(0, theQuery.length - 4);
    return theQuery
}

/**
 * create a distance query for orchestrate
 * assuming the field name is "location"
 * @param lat
 * @param long
 * @param radius
 * @returns {string}
 */
function createDistanceQuery(lat, long, radius) {
    var theDistanceQuery = "value.location:NEAR:{lat:" + parseFloat(lat) + " lon:" + parseFloat(long) + " dist:" + radius + "}";
    return theDistanceQuery
}

/**
 * create a eventId search query
 * @param eventId
 */
function createSearchByIdQuery(id) {
    var searchByIdQuery = "@path.key:" + id + ""
    return searchByIdQuery
}

/**
 * Inserts the id into every response object
 * extracted from orchestrate's "path" key
 * @param results
 * @returns {Array}
 */
function injectId(results) {
    var response = results.body.results.map(function (aResult) {
        var value = aResult.value
        value["id"] = aResult.path.key
        return value
    })
    return response
}

/**
 * Delete a graph relation from orchestrate
 * @param from
 * @param fromKey
 * @param to
 * @param toKey
 * @param relationName
 */
function deleteGraphRelation(from, fromKey, to, toKey, relationName) {
    db.newGraphBuilder()
        .remove()
        .from(from, fromKey)
        .related(relationName)
        .to(to, toKey);
}

/**
 * generate a one on one graph relation query
 * @param sourceCollection
 * @param sourceId
 * @param destinationCollection
 * @param destinationId
 */
function createGetOneOnOneGraphRelationQuery(sourceCollection, sourceId, relation, destinationCollection, destinationId) {
    var query =
        "@path.kind:relationship AND @path.source.collection:`" +
        sourceCollection +
        "` AND @path.source.key:`" +
        sourceId + "` AND @path.relation:`" +
        relation + "` AND @path.destination.collection:`" +
        destinationCollection + "` AND @path.destination.key:`" +
        destinationId + "`"
    return query
}

module.exports = {
    injectId : injectId,
    createGetOneOnOneGraphRelationQuery : createGetOneOnOneGraphRelationQuery,
    createGraphRelation : createGraphRelation,
    createGraphRelationPromise : createGraphRelationPromise,
    createFieldORQuery : createFieldORQuery,
    getGraphResultsPromise : getGraphResultsPromise,
    createSearchByIdQuery : createSearchByIdQuery,
    createDistanceQuery : createDistanceQuery,
    deleteGraphRelation : deleteGraphRelation,
    queryJoiner : queryJoiner
}


