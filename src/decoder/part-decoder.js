'use strict';

var Q = require('q');

var fill = require('lodash/fill');
var ctype = require('ctype');
var definition = require('../definition');
var converters = require('../converters');
var types = require('../../metadata/typesdb.json');

var valueDecoder = require('./value-decoder');
var commonDecoder = require('./common-decoder');

/**
 * Decodes a part with string format
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @param partLen The size of the part
 * @returns {string} The decoded string
 */
function decodeStringPart(buffer, offset, partLen) {
    var deferred = Q.defer();

    setImmediate(function () {
        var stringOffset = definition.HEADER_SIZE + offset;

        var decoded = '';
        for (var i = 0; i < (partLen - 5); i++) {
            var decodedChar = String.fromCharCode(ctype.rsint8(buffer, 'big', stringOffset));
            decoded = decoded.concat(decodedChar);
            stringOffset++;
        }

        deferred.resolve(decoded);
    });
    return deferred.promise;
}

/**
 * Decodes a part with numeric format.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {number} The decoded number
 */
function decodeNumericPart(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        deferred.resolve(converters.to64(ctype.rsint64(buffer, 'big', definition.HEADER_SIZE + offset)));
    });
    return deferred.promise;
}

/**
 * Decodes a part encoded in a high resolution number format.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {number} The decoded number
 */
function decodeHighResolutionPart(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        decodeNumericPart(buffer, offset)
            .then(function (highResolution) {
                var lowRes = converters.toLowResolution(highResolution);
                deferred.resolve(lowRes);
            });
    });
    return deferred.promise;
}

function toDsname(dataType) {
    return dataType.dsname;
}

/**
 * Return the dsname of the current metric for building a value part.
 *
 * @param metric The current metric being built
 * @param numberOfValues Number of values
 * @returns {string} The dsname, which 'value' is the default
 */
function getDsnamesFromMetric(metric, numberOfValues) {
    var dsnames;

    var typeName = converters.getTypeNameFromCode(definition.TYPE_TYPE);
    var dataType = metric[typeName];

    if (dataType !== undefined) {
        var dataTypes = types[dataType];

        if (dataTypes !== undefined) {
            dsnames = dataTypes.map(toDsname);
        }
    }

    if (typeof dsnames === 'undefined') {
        dsnames = fill(new Array(numberOfValues), 'value');
    }

    return dsnames;
}

/**
 * Returns a function that uses a decoder to decode the a buffer with the specified offset.
 *
 * @param buffer The buffer to decode
 * @param valuesOffset The offset where to start decoding
 * @returns {Function} A function to decode the buffer
 */
function useDecoderWith(buffer, valuesOffset) {
    return function (decoder) {
        return decoder(buffer, valuesOffset);
    };
}

/**
 * Returns a function to push a decoded value to the specified array of values.
 *
 * @param values An array of values to push the decoded value
 * @param dsname The dsname of the type
 * @returns {Function} A function to push the decoded value
 */
function pushDecodedValuesTo(values, dsname) {
    return function (decoded) {
        values.values.push(decoded.value);
        values.dstypes.push(decoded.type);
        values.dsnames.push(dsname);
    };
}

/**
 * Returns a function to update the value offsets.
 *
 * @param typeOffset The type offset to update
 * @param valuesOffset The values offset to update
 * @returns {Function} A function to update the offsets
 */
function updateValueOffsets(typeOffset, valuesOffset) {
    return function() {
        typeOffset++;
        valuesOffset += definition.VALUE_SIZE;
    };
}

/**
 * Decodes the values part.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @param partLen The length og the values part
 * @param metric the metric being constructed
 * @returns {{dstypes: Array, values: Array}} A decoded part
 */
function decodeValuesPart(buffer, offset, partLen, metric) {
    var deferred = Q.defer();

    setImmediate(function () {
        var values = {dstypes: [], values: [], dsnames: []};

        // Decode values size
        commonDecoder.decodeValuesSize(buffer, offset)
            .then(function (numberOfValues) {
                var typeOffset = offset + definition.HEADER_AND_LENGTH_SIZE;
                var valuesOffset = typeOffset + numberOfValues;

                function continueOrEnd() {
                    if (values.values.length === numberOfValues) {
                        deferred.resolve(values);
                    }
                }

                var dsname = getDsnamesFromMetric(metric);

                // Decode types
                for (var i = 0; i < numberOfValues; i++) {
                    commonDecoder.decodeValueType(buffer, typeOffset + i)
                        .then(valueDecoder.getFromValueType)
                        .then(useDecoderWith(buffer, valuesOffset + (i * definition.VALUE_SIZE)))
                        .then(pushDecodedValuesTo(values, dsname[i]))
                        .then(updateValueOffsets(typeOffset, valuesOffset))
                        .then(continueOrEnd);
                }
            });
    });
    return deferred.promise;
}

/**
 * Returns a parts decoder based on the passed part type.
 *
 * @param partType The part type code
 * @returns {*} A parts decoder
 */
function getFromHeaderType(partType) {
    var decoders = [];

    decoders[definition.TYPE_HOST] = decodeStringPart;
    decoders[definition.TYPE_PLUGIN] = decodeStringPart;
    decoders[definition.TYPE_PLUGIN_INSTANCE] = decodeStringPart;
    decoders[definition.TYPE_TYPE] = decodeStringPart;
    decoders[definition.TYPE_TYPE_INSTANCE] = decodeStringPart;
    decoders[definition.TYPE_MESSAGE] = decodeStringPart;
    decoders[definition.TYPE_TIME] = decodeNumericPart;
    decoders[definition.TYPE_TIME_HIRES] = decodeHighResolutionPart;
    decoders[definition.TYPE_INTERVAL] = decodeNumericPart;
    decoders[definition.TYPE_INTERVAL_HIRES] = decodeHighResolutionPart;
    decoders[definition.TYPE_SEVERITY] = decodeNumericPart;
    decoders[definition.TYPE_VALUES] = decodeValuesPart;

    return decoders[partType];
}

exports.decodeStringPart = decodeStringPart;
exports.getFromHeaderType = getFromHeaderType;