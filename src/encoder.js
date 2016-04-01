'use strict';

var assign = require('lodash/assign');
var findKey = require('lodash/findKey');
var matches = require('lodash/matches');
var isUndefined = require('lodash/isUndefined');

var ctype = require('ctype');
var definition = require('./definition');
var converters = require('./converters');
var customPartValidator = require('./custom-part-validator');

// Initialize custom parts configuration, which by default is empty
var customStringParts = {};

/**
 * Encodes a part header.
 *
 * @param type  The type of part to encode
 * @param partBuffer The buffer of the part being encoded
 * @param headerSize The size to encode in the header
 */
function encodeHeader(type, partBuffer, headerSize) {
    ctype.wuint16(type, 'big', partBuffer, 0);
    ctype.wuint16(definition.HEADER_SIZE + headerSize, 'big', partBuffer, definition.LENGTH_SIZE);
}

/**
 * Encoded a string part.
 *
 * @param partBuffer The buffer of the part being encoded
 * @param string The string value to encode
 */
function encodeStringPart(partBuffer, string) {
    var offset = definition.HEADER_SIZE;
    for (var i = 0; i < string.length; i++) {
        ctype.wuint8(string.charCodeAt(i), 'big', partBuffer, offset + i);
    }
}

/**
 * Encodes a string with its header.
 *
 * @param type The type of part to encode
 * @param string The string value to encode
 * @returns {Buffer} The constructed buffer with the encoded string
 */
function encodeString(type, string) {
    var stringSize = string.length + definition.NULL_BYTE_SIZE;

    var partBuffer = new Buffer(definition.HEADER_SIZE + stringSize);

    encodeHeader(type, partBuffer, stringSize);
    encodeStringPart(partBuffer, string);

    return partBuffer;
}

/**
 * Encodes a numeric part.
 *
 * @param partBuffer The buffer of the part being encoded
 * @param value The numeric value to encode
 */
function encodeNumericPart(partBuffer, value) {
    ctype.wsint64(converters.approximateInt64ToHexArray(value), 'big', partBuffer, definition.HEADER_SIZE);
}

/**
 * Encodes a number with its header.
 *
 * @param type The type of part to encode
 * @param value The numeric value to encode
 * @returns {Buffer} The constructed buffer with the encoded number
 */
function encodeNumeric(type, value) {
    var partBuffer = new Buffer(definition.HEADER_AND_NUM_PART_SIZE);

    encodeHeader(type, partBuffer, definition.NUM_PART_SIZE);
    encodeNumericPart(partBuffer, value);

    return partBuffer;
}

/**
 * Encodes a number with its header in high resolution format.
 *
 * @param type The type of part to encode
 * @param value The numeric value to encode
 * @returns {Buffer} The constructed buffer with the encoded number
 */
function encodeHighResolutionPart(type, value) {
    var partBuffer = new Buffer(definition.HEADER_AND_NUM_PART_SIZE);

    encodeHeader(type, partBuffer, definition.NUM_PART_SIZE);
    encodeNumericPart(partBuffer, value);

    return partBuffer;
}

/**
 * Returns the definition of a counter, containing the value (in hex array format).
 *
 * @param value The value to place on the counter definition
 * @returns {*} The counter definition
 */
function getCounterDefinition(value) {
    return {
        type: definition.DS_TYPE_COUNTER,
        definition: 'uint64',
        endian: 'big',
        value: converters.approximateInt64ToHexArray(value)
    };
}

/**
 * Returns the definition of a gauge, containing the value (in hex array format).
 *
 * @param value The value to place on the gauge definition
 * @returns {*} The gauge definition
 */
function getGaugeDefinition(value) {
    return {
        type: definition.DS_TYPE_GAUGE,
        definition: 'double',
        endian: 'little',
        value: value
    };
}

/**
 * Returns the definition of a derive, containing the value (in hex array format).
 *
 * @param value The value to place on the derive definition
 * @returns {*} The derive definition
 */
function getDeriveDefinition(value) {
    return {
        type: definition.DS_TYPE_DERIVE,
        definition: 'sint64',
        endian: 'big',
        value: converters.approximateInt64ToHexArray(value)
    };
}

/**
 * Returns the definition of a absolute, containing the value (in hex array format).
 *
 * @param value The value to place on the absolute definition
 * @returns {*} The absolute definition
 */
function getAbsoluteDefinition(value) {
    return {
        type: definition.DS_TYPE_ABSOLUTE,
        definition: 'uint64',
        endian: 'big',
        value: converters.approximateInt64ToHexArray(value)
    };
}

/**
 * Returns a value definer based on the value type.
 *
 * @param dstype The type of the value
 * @returns {*} A function to get a value definition
 */
function getValueDefiner(dstype) {
    var definitions = [];

    definitions['counter'] = getCounterDefinition;
    definitions['gauge'] = getGaugeDefinition;
    definitions['derive'] = getDeriveDefinition;
    definitions['absolute'] = getAbsoluteDefinition;

    return definitions[dstype];
}

/**
 * Returns a value definition from the passed value type.
 *
 * @param dstype The value type to get the definition
 * @param value The vale to append on the definition
 * @returns {*} A value definition
 */
function getValueDefinition(dstype, value) {
    var definition = getValueDefiner(dstype);
    return definition(value);
}

/**
 * Encodes a values size, to encode after the header.
 *
 * @param partBuffer The buffer of the part being encoded
 * @param valuesSize The size value to encode
 */
function encodeValuesSize(partBuffer, valuesSize) {
    ctype.wuint16(valuesSize, 'big', partBuffer, definition.HEADER_SIZE);
}

/**
 * Encode the part type.
 *
 * @param partBuffer The buffer of the part being encoded
 * @param offset The offset to start writing
 * @param type The type to encode
 */
function encodeType(partBuffer, offset, type) {
    ctype.wuint8(parseInt(type), 'big', partBuffer, offset);
}

/**
 * Encode value.
 *
 * @param typeDef The type definition to encode
 * @param partBuffer The buffer of the part being encoded
 * @param offset The offset to start writing
 * @param value The value to encode
 */
function encodeValue(typeDef, partBuffer, offset, value) {
    var definition = typeDef.definition;
    var endieness = typeDef.endian;

    ctype['w' + definition](value, endieness, partBuffer, offset);
}

/**
 * Encodes a values part.
 *
 * @param dstypes The type of value to encode
 * @param values The values to encode
 * @returns {Buffer} The constructed buffer with the encoded values
 */
function encodeValuesPart(dstypes, values) {
    var payloadSize = values.length * definition.VALUE_NUMBER_AND_VALUE_SIZE;
    var partBuffer = new Buffer(definition.HEADER_AND_LENGTH_SIZE + payloadSize);

    encodeHeader(definition.TYPE_VALUES, partBuffer, definition.LENGTH_SIZE + payloadSize);
    encodeValuesSize(partBuffer, values.length);

    var numberOfValues = dstypes.length;

    var typeOffset = definition.HEADER_AND_LENGTH_SIZE;
    var valueOffset = typeOffset + numberOfValues;

    for (var i = 0; i < numberOfValues; i++) {
        var typeDef = getValueDefinition(dstypes[i], values[i]);
        encodeType(partBuffer, typeOffset, typeDef.type);
        encodeValue(typeDef, partBuffer, valueOffset, typeDef.value);

        typeOffset++;
        valueOffset += 8;
    }

    return partBuffer;
}

/**
 * Returns a part encoder from the specified part type.
 *
 * @param partType The parts type
 * @returns {*} The parts encoder
 */
function getPartEncoder(partType) {
    var encoders = [];

    encoders['host'] = encodeString;
    encoders['plugin'] = encodeString;
    encoders['plugin_instance'] = encodeString;
    encoders['type'] = encodeString;
    encoders['type_instance'] = encodeString;
    encoders['message'] = encodeString;
    encoders['time'] = encodeNumeric;
    encoders['time_hires'] = encodeHighResolutionPart;
    encoders['interval'] = encodeNumeric;
    encoders['interval_hires'] = encodeHighResolutionPart;
    encoders['severity'] = encodeNumeric;
    encoders['dstypes'] = encodeValuesPart;
    encoders['values'] = encodeValuesPart;
    encoders['dsnames'] = encodeValuesPart;

    return encoders[partType];
}

function isValue(partType) {
    return partType === 'values';
}

function isAttributeValid(partType) {
    return partType !== 'dstypes' && partType !== 'dsnames';
}

/**
 *
 * @param partType
 */
function getTypeCodeFromName(partType) {
    var typeCode = converters.getTypeCodeFromName(partType);

    if (isUndefined(typeCode)) {
        var customTypeCode = findKey(customStringParts, matches(partType));

        if (!isUndefined(customTypeCode)) {
            typeCode = parseInt(customTypeCode);
        }
    }

    return typeCode;
}

/**
 *
 * @param partType
 */
function getPartEncoderFromPartType(partType) {
    var encoder = getPartEncoder(partType);

    if (isUndefined(encoder)) {
        encoder = encodeString;
    }

    return encoder;
}

/**
 * Encodes a type from the specified metric.
 *
 * @param partType The part type of the metric to encode
 * @param metric  The metric containing parts to encode
 * @returns {Buffer} The constructed buffer with the encoded part
 */
function encodeMetric(partType, metric) {
    var type = getTypeCodeFromName(partType);
    var encoder = getPartEncoderFromPartType(partType);

    if (isUndefined(encoder) || isUndefined(type)) {
        throw (new Error('Invalid part type found: ' + partType));
    }

    var resultBuffer;
    if (isValue(partType)) {
        resultBuffer = encoder(metric.dstypes, metric.values);
    } else {
        resultBuffer = encoder(type, metric[partType]);
    }
    return resultBuffer;
}

/**
 * Encodes an array of metrics.
 *
 * @param metrics An array of metrics to encode
 * @returns {Buffer} The constructed buffer with the encoded metrics
 */
function encodeMetrics(metrics) {
    // TODO - provide size for better performance when concat
    var buffer = new Buffer(0);

    metrics.forEach(function (metric) {
        for (var partType in metric) {
            if (metric.hasOwnProperty(partType) && isAttributeValid(partType)) {
                var resultBuffer = encodeMetric(partType, metric);
                buffer = Buffer.concat([buffer, resultBuffer]);
            }
        }
    });

    return buffer;
}

/**
 * Encoder function.
 *
 * @param metrics An array of metrics to encode to Collectd's binary protocol
 * @returns {*} An encoded buffer
 */
function encode(metrics) {
    var buffer;

    try {
        if (metrics instanceof Array) {
            buffer = encodeMetrics(metrics);
        } else {
            console.error('value must be an array');
        }
    } catch (err) {
        console.error(err);
    }

    return buffer;
}

/**
 * Configures the passed custom parts to encode.
 *
 * @param customPartsConfig A custom parts configuration object
 */
function configureCustomParts(customPartsConfig) {
    var isValid = customPartValidator.validateCustomPartsConfig(customPartsConfig);

    if (isValid) {
        assign(customStringParts, customPartsConfig);
    }
}

/**
 * Encodes an array of metrics to the collectd's binary protocol. Please reference to:
 * {@link https://collectd.org/wiki/index.php/Binary_protocol}
 *
 * @param metrics The array of metrics to encode
 * @returns {Buffer} The constructed buffer with the encoded metrics
 */
exports.encode = encode;

/**
 *
 * @param metrics
 * @param customPartsConfig
 * @returns {*}
 */
exports.encodeCustom = function(metrics, customPartsConfig) {

    if (!isUndefined(customPartsConfig)) {
        configureCustomParts(customPartsConfig);
    }

    return encode(metrics);
};