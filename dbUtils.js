var config = require('./config.js');
var oio = require('orchestrate');
oio.ApiEndPoint = config.db.region;
var db = oio(config.db.key);
var constants = require('./constants');
var qbchat = require('./Chat/qbchat');
var kew = require('kew')
var json2csv = require('json2csv')
var fs = require('fs')
/**
 * Orchestrate query wrappers ---------------------------------->
 * Query helpers to make life a lot, lot easier
 */

/**
 * create a graph relation
 * @param from
 * @param fromKey
 * @param to
 * @param toKey
 * @param relationName
 * @returns {Object}
 */
function createGraphRelationPromise(from, fromKey, to, toKey, relationName) {
    return db.newGraphBuilder()
        .create()
        .from(from, fromKey)
        .related(relationName)
        .to(to, toKey);
}

/**
 * check if key exists.
 * fully qualified path expected:
 * _exists_:value.sports.pool
 * @param fieldPath
 */
function createExistsQuery(fieldPath) {
    return "_exists_:" + fieldPath
}

/**
 *
 * @param collection
 * @param id
 * @param relation
 * @returns {GraphBuilder}
 */
function getGraphResultsPromise(collection, id, relation) {
    var offset = 0
    var limit = constants.db.limit
    return db.newGraphReader()
        .get()
        .from(collection, id)
        .related(relation)
        //.offset(offset)
        //.limit(limit)
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
    if (returnQuery != "")
        returnQuery = returnQuery.substring(0, returnQuery.length - 5)
    return returnQuery
}

function incrementFieldValue(collection, key, fieldPath) {
    return db.newPatchBuilder(collection, key)
        .inc(fieldPath, 1)
        .apply()
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
    theQuery = theQuery.substring(0, theQuery.length - 4);
    theQuery += ")"
    return theQuery
}

function createFieldQuery(field, value) {
    return "value." + field + ":`" + value + "`"
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
function deleteGraphRelationPromise(from, fromKey, to, toKey, relationName) {
    return db.newGraphBuilder()
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

/**
 * join a set of queries with AND, OR conditions
 * for lucene/orchestrate
 * @param queries
 * @param type
 */
function queryJoinerOr(queries) {
    var returnQuery = ""
    queries.forEach(function (query) {
        returnQuery += "("
        returnQuery += query
        returnQuery += ") OR "
    })
    if (returnQuery != "")
        returnQuery = returnQuery.substring(0, returnQuery.length - 4)
    return returnQuery
}

/**
 * a little fuzzy with the query,
 * search-- expecting sanitized value
 * @param field
 * @param value
 * @returns {string}
 */
function createFuzzyQuery(field, value) {
    return "value." + field + ":" + value + "*"
}

/**
 * this returns an array of promises that allows to retrieve an entire
 * dump of the database collection - again non graph relations
 * you can select the field list here
 * @param collection
 * @returns {!Promise}
 */
function allItemsPromisesListWithFields(collection, query, fields) {
    console.log("inside allItemsPromisesList")
    var promiseList = kew.defer()
    var promiseListArray = []
    var offset = 0
    db.newSearchBuilder()
        .collection(collection)
        .withFields(fields)
        .limit(100)
        .offset(offset)
        .query(query)
        .then(function (results) {
            console.log("this many results")
            console.log(results.body.total_count)
            var totalCount = results.body.total_count
            var remaining = 0
            do {
                promiseListArray.push(
                    db.newSearchBuilder()
                        .collection(collection)
                        .withFields(fields)
                        .limit(100)
                        .offset(offset)
                        .query(query)
                )
                offset += 100
                remaining = totalCount - offset;
            } while (remaining > 0)
            promiseList.resolve(promiseListArray)
        })
        .fail(function (err) {
            promiseList.reject(err)
        })
    return promiseList
}

/**
 * @refer - getAllItems(collection, query)
 * @param collection
 * @param query
 * @returns {!Promise}
 */
function getAllItemsWithFields(collection, query, fields) {
    var allItems = kew.defer()
    allItemsPromisesListWithFields(collection, query, fields)
        .then(function (promiseList) {
            return kew.all(promiseList)
        })
        .then(function (promiseResults) {
            var allItemsList = []
            console.log(injectId(promiseResults[0]))
            promiseResults.forEach(function (item) {
                // console.log(item.body.results[0].path.destination)
                var injectedItems = injectId(item)
                allItemsList = allItemsList.concat(injectedItems)
            })
            allItems.resolve(allItemsList)
        })
        .fail(function (err) {
            allItems.reject(err)
        })
    return allItems
}

/**
 * this returns an array of promises that allows to retrieve an entire
 * dump of the database collection - again non graph relations
 * @param collection
 * @returns {!Promise}
 */
function allItemsPromisesList(collection, query) {
    console.log("inside allItemsPromisesList")
    var promiseList = kew.defer()
    var promiseListArray = []
    var offset = 0
    db.newSearchBuilder()
        .collection(collection)
        .limit(100)
        .offset(offset)
        .query(query)
        .then(function (results) {
            console.log("this many results")
            console.log(results.body.total_count)
            var totalCount = results.body.total_count
            var remaining = 0
            do {
                promiseListArray.push(
                    db.newSearchBuilder()
                        .collection(collection)
                        .limit(100)
                        .offset(offset)
                        .query(query)
                )
                offset += 100
                remaining = totalCount - offset;
            } while (remaining > 0)
            promiseList.resolve(promiseListArray)
        })
        .fail(function (err) {
            promiseList.reject(err)
        })
    return promiseList
}

/**
 * this returns all the items in a database collection
 * asynchronously - non graph queries
 * @param collection
 * @returns {!Promise}
 */
function getAllItems(collection, query) {
    var allItems = kew.defer()
    allItemsPromisesList(collection, query)
        .then(function (promiseList) {
            return kew.all(promiseList)
        })
        .then(function (promiseResults) {
            var allItemsList = []
            // console.log(injectId(promiseResults[0]))
            promiseResults.forEach(function (item) {
                // console.log(item.body.results[0].path.destination)
                var injectedItems = injectId(item)
                allItemsList = allItemsList.concat(injectedItems)
            })
            allItems.resolve(allItemsList)
        })
        .fail(function (err) {
            allItems.reject(err)
        })
    return allItems
}

function getAllGraphItems(collection, id, relation) {
    var allGraphItemsPromise = kew.defer()
    var graphItems = []
    getGraphItems(collection, id, relation, 0)

    function getGraphItems(collection, id, relation, offset) {
        console.log("offset value -- " + offset)
        db.newGraphReader()
            .get()
            .limit(constants.pagination.limit)
            .offset(offset)
            .from(collection, id)
            .related(relation)
            .then(function (result) {
                Array.prototype.push.apply(graphItems,injectId(result))
                if (result.body.next != undefined) {
                    getGraphItems(collection, id, relation, offset + constants.pagination.limit);
                } else {
                    graphItemsDone()
                }
            })
            .fail(function (err) {
                allGraphItemsPromise.reject(err)
                console.log(err)
            })
    }

    function graphItemsDone() {
        allGraphItemsPromise.resolve(graphItems)
    }
    
    return allGraphItemsPromise
}

function generateCsvForGraphRelationsFile(collection, id, relation) {
    var fs = require('fs')
    var fileStatus = kew.defer()
    generateCsvForGraphRelations(collection, id, relation)
        .then(function (csvDump) {
            var filename = collection + "-" + id + ".csv"
            var filepath = __dirname + "/csv/" + filename
            fs.writeFile(filepath, csvDump, function (err) {
                if (err) {
                    console.log(err);
                    fileStatus.reject(err)
                } else {
                    fileStatus.resolve()
                    console.log("The file was saved!");
                }
            });
        })
    return fileStatus
}

function generateCsvForGraphRelations(collection, id, relation) {
    var generatedCsvStatus = kew.defer()
    getAllGraphItems(collection, id, relation)
        .then(function (results) {
            json2csv({data: results}, function (err, csv) {
                if (err) {
                    console.log(err);
                    generatedCsvStatus.reject(err)
                } else {
                    // console.log(csv);
                    generatedCsvStatus.resolve(csv)
                }
            });
        })
        .fail(function (err) {
            generatedCsvStatus.reject(err)
        })
    return generatedCsvStatus
}

function generateCsv(collection, query) {
    var generatedCsvStatus = kew.defer()
    getAllItems(collection, query)
        .then(function (results) {
            json2csv({data: results}, function (err, csv) {
                if (err) {
                    console.log(err);
                    generatedCsvStatus.reject(err)
                } else {
                    // console.log(csv);
                    generatedCsvStatus.resolve(csv)
                }
            });
        })
        .fail(function (err) {
            generatedCsvStatus.reject(err)
        })
    return generatedCsvStatus
}

function generateCsvFile(collection, query) {
    var fs = require('fs')
    var fileStatus = kew.defer()
    generateCsv(collection, query)
        .then(function (csvDump) {
            var filename = collection + ".csv"
            var filepath = __dirname + "/csv/" + filename
            fs.writeFile(filepath, csvDump, function (err) {
                if (err) {
                    console.log(err);
                    fileStatus.reject(err)
                } else {
                    fileStatus.resolve()
                    console.log("The file was saved!");
                }
            });
        })
    return fileStatus
}

/**
 * when you do a db.post
 * the id of the newly created record is present in the header
 * this method returns that id
 * @param result
 * @returns {*}
 */
function getIdAfterPost(result) {
    return result.headers.location.match(/[0-9a-z]{16}/)[0];
}

module.exports = {
    injectId: injectId,
    createGetOneOnOneGraphRelationQuery: createGetOneOnOneGraphRelationQuery,
    createGraphRelationPromise: createGraphRelationPromise,
    createFieldORQuery: createFieldORQuery,
    getGraphResultsPromise: getGraphResultsPromise,
    createSearchByIdQuery: createSearchByIdQuery,
    createDistanceQuery: createDistanceQuery,
    deleteGraphRelationPromise: deleteGraphRelationPromise,
    queryJoiner: queryJoiner,
    createFuzzyQuery : createFuzzyQuery,
    queryJoinerOr : queryJoinerOr,
    createExistsQuery : createExistsQuery,
    incrementFieldValue : incrementFieldValue,
    createFieldQuery:createFieldQuery,
    getAllItemsWithFields : getAllItemsWithFields,
    getIdAfterPost : getIdAfterPost,
    generateCsvFile : generateCsvFile,
    generateCsvForGraphRelationsFile : generateCsvForGraphRelationsFile
}


