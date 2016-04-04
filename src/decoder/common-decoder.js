'use strict';

var Q = require('q');

var ctype = require('ctype');
var definition = require('../definition');

/**
 * Decodes the part header.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{type: number, length: number}} A decoded header
 */
function decodeHeader(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        var type = ctype.ruint16(buffer, 'big', offset);
        var length = ctype.ruint16(buffer, 'big', offset + 2);

        return deferred.resolve({type: type, length: length});
    });
    return deferred.promise;
}

/**
 * Decodes the number of values contained in a metric, encoded after the header.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {number} The number of values in a values part
 */
function decodeValuesSize(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        deferred.resolve(ctype.ruint16(buffer, 'big', offset + definition.HEADER_SIZE));
    });

    return deferred.promise;
}

/**
 * Decodes the value type ('host', 'time', etc.).
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {number} The type code
 */
function decodeValueType(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        deferred.resolve(ctype.ruint8(buffer, 'big', offset));
    });
    return deferred.promise;
}

exports.decodeHeader = decodeHeader;
exports.decodeValuesSize = decodeValuesSize;
exports.decodeValueType = decodeValueType;