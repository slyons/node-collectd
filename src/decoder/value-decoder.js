'use strict';

var Q = require('q');

var ctype = require('ctype');
var definition = require('../definition');
var converters = require('../converters');

/**
 * Decodes a counter value.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{value: number, type: string}} The decoded counter
 */
function decodeCounter(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        var counter = ctype.ruint64(buffer, 'big', offset);
        deferred.resolve({value: converters.to64(counter), type: 'counter'});
    });
    return deferred.promise;
}

/**
 * Decodes a derive value.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{value: number, type: string}} The decoded derive
 */
function decodeDerive(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        var derive = ctype.rsint64(buffer, 'big', offset);
        deferred.resolve({value: converters.to64(derive), type: 'derive'});
    });
    return deferred.promise;
}

/**
 * Decodes a gauge value.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{value: number, type: string}} The gauge counter
 */
function decodeGauge(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        var gauge = ctype.rdouble(buffer, 'little', offset);
        deferred.resolve({value: gauge, type: 'gauge'});
    });
    return deferred.promise;
}

/**
 * Decodes an absolute value.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{value: number, type: string}} The decoded absolute
 */
function decodeAbsolute(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        var absolute = ctype.ruint64(buffer, 'big', offset);
        deferred.resolve({value: converters.to64(absolute), type: 'absolute'});
    });
    return deferred.promise;
}

/**
 * Returns the decoder for the passed value type.
 *
 * @param valueType The value type
 * @returns {*} A value decoder (counter, derive, gauge or absolute)
 */
function getFromValueType(valueType) {
    var decoder = [];

    decoder[definition.DS_TYPE_COUNTER] = decodeCounter;
    decoder[definition.DS_TYPE_DERIVE] = decodeDerive;
    decoder[definition.DS_TYPE_GAUGE] = decodeGauge;
    decoder[definition.DS_TYPE_ABSOLUTE] = decodeAbsolute;

    return decoder[valueType];
}

exports.getFromValueType = getFromValueType;