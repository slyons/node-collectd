'use strict';

var protocol = require('./definition');
var ctype = require('ctype');

/**
 *
 * @param type
 * @param partBuffer
 * @param headerSize
 */
function encodeHeader(type, partBuffer, headerSize) {
    ctype.wuint16(type, 'big', partBuffer, 0);
    ctype.wuint16(protocol.HEADER_SIZE + headerSize, 'big', partBuffer, protocol.LENGTH_SIZE);
}

/**
 *
 * @param partBuffer
 * @param string
 */
function encodeStringPart(partBuffer, string) {
    var offset = protocol.HEADER_SIZE;
    for (var i = 0; i < string.length; i++) {
        ctype.wuint8(string.charCodeAt(i), 'big', partBuffer, offset + i);
    }
}

/**
 *
 * @param type
 * @param string
 * @returns {Buffer}
 */
function encodeString(type, string) {
    var stringSize = string.length + protocol.NULL_BYTE_SIZE;

    var partBuffer = new Buffer(protocol.HEADER_SIZE + stringSize);

    encodeHeader(type, partBuffer, stringSize);
    encodeStringPart(partBuffer, string);

    return partBuffer;
}

/**
 *
 * @param value
 * @returns {number}
 */
function addSign(value) {
    return 0 - value;
}

/**
 *
 * @param value
 * @returns {*[]}
 */
function int64ToHexArray(value) {
    var hexValue = Math.abs(value).toString(protocol.MAX_BYTES);
    if (hexValue.length < protocol.MAX_BYTES) {
        var zeros = new Array(protocol.MAX_BYTES - hexValue.length);
        zeros.fill(0);
        hexValue = zeros.join('').concat(hexValue);
    }

    var lhs = parseInt(hexValue.substring(0, protocol.HALF_BYTES), protocol.MAX_BYTES);
    var rhs = parseInt(hexValue.substring(protocol.HALF_BYTES, protocol.MAX_BYTES), protocol.MAX_BYTES);

    if (value < 0) {
        return [addSign(lhs), addSign(rhs)];
    } else {
        return [lhs, rhs];
    }
}

/**
 *
 * @param partBuffer
 * @param value
 */
function encodeNumericPart(partBuffer, value) {
    ctype.wsint64(int64ToHexArray(value * 100000000), 'big', partBuffer, protocol.HEADER_SIZE);
}

/**
 *
 * @param type
 * @param value
 * @returns {Buffer}
 */
function encodeNumeric(type, value) {
    var partBuffer = new Buffer(protocol.HEADER_AND_NUM_PART_SIZE);

    encodeHeader(type, partBuffer, protocol.NUM_PART_SIZE);
    encodeNumericPart(partBuffer, value);

    return partBuffer;
}

/**
 *
 * @param value
 * @returns {{type: *[], definition: (exports.counterDefinition|*), endian: string, value: *[]}}
 */
function getCounterDefinition(value) {
    return {
        type: protocol.DS_TYPE_COUNTER,
        definition: 'uint64',
        endian: 'big',
        value: int64ToHexArray(value)
    };
}

/**
 *
 * @param value
 * @returns {{type: *[], definition: (exports.gaugeDefinition|*), endian: string, value: *[]}}
 */
function getGaugeDefinition(value) {
    return {
        type: protocol.DS_TYPE_GAUGE,
        definition: 'double',
        endian: 'little',
        value: value
    };
}

/**
 *
 * @param value
 * @returns {{type: *[], definition: (exports.deriveDefinition|*), endian: string, value: *[]}}
 */
function getDeriveDefinition(value) {
    return {
        type: protocol.DS_TYPE_DERIVE,
        definition: 'sint64',
        endian: 'big',
        value: int64ToHexArray(value)
    };
}

/**
 *
 * @param value
 * @returns {{type: *[], definition: (exports.absoluteDefinition|*), endian: string, value: *[]}}
 */
function getAbsoluteDefinition(value) {
    return {
        type: protocol.DS_TYPE_ABSOLUTE,
        definition: 'uint64',
        endian: 'big',
        value: int64ToHexArray(value)
    };
}

/**
 *
 * @param dstype
 * @returns {*}
 */
function getDefinition(dstype) {
    var definitions = [];

    definitions['counter'] = getCounterDefinition;
    definitions['gauge'] = getGaugeDefinition;
    definitions['derive'] = getDeriveDefinition;
    definitions['absolute'] = getAbsoluteDefinition;

    return definitions[dstype];
}

/**
 *
 * @param dstype
 * @param value
 * @returns {*}
 */
function getTypeDefinition(dstype, value) {
    var definition = getDefinition(dstype);
    return definition(value);
}

/**
 *
 * @param partBuffer
 * @param valuesSize
 */
function encodeValuesSize(partBuffer, valuesSize) {
    ctype.wuint16(valuesSize, 'big', partBuffer, protocol.HEADER_SIZE);
}

/**
 *
 * @param partBuffer
 * @param offset
 * @param type
 */
function encodeType(partBuffer, offset, type) {
    ctype.wuint8(parseInt(type), 'big', partBuffer, offset);
}

/**
 *
 * @param typeDef
 * @param partBuffer
 * @param offset
 * @param value
 */
function encodeValue(typeDef, partBuffer, offset, value) {
    var definition = typeDef.definition;
    var endieness = typeDef.endian;

    ctype['w' + definition](value, endieness, partBuffer, offset);
}

/**
 *
 * @param dstypes
 * @param values
 * @returns {Buffer}
 */
function encodeValuesPart(dstypes, values) {
    var payloadSize = values.length * protocol.VALUE_NUMBER_AND_VALUE_SIZE;
    var partBuffer = new Buffer(protocol.HEADER_AND_LENGTH_SIZE + payloadSize);

    encodeHeader(protocol.TYPE_VALUES, partBuffer, protocol.LENGTH_SIZE + payloadSize);
    encodeValuesSize(partBuffer, values.length);

    var numberOfValues = dstypes.length;

    var typeOffset = protocol.HEADER_AND_LENGTH_SIZE;
    var valueOffset = typeOffset + numberOfValues;

    for (var i = 0; i < numberOfValues; i++) {
        var typeDef = getTypeDefinition(dstypes[i], values[i]);
        encodeType(partBuffer, typeOffset, typeDef.type);
        encodeValue(typeDef, partBuffer, valueOffset, typeDef.value);

        typeOffset++;
        valueOffset += 8;
    }

    return partBuffer;
}

/**
 *
 * @param partType
 * @returns {*}
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
    encoders['time_hires'] = encodeNumeric;
    encoders['interval'] = encodeNumeric;
    encoders['interval_hires'] = encodeNumeric;
    encoders['severity'] = encodeNumeric;
    encoders['dstypes'] = encodeValuesPart;
    encoders['values'] = encodeValuesPart;
    encoders['dsnames'] = encodeValuesPart;

    return encoders[partType];
}

/**
 *
 * @param partType
 * @returns {boolean}
 */
function isValue(partType) {
    return partType === 'values';
}

/**
 *
 * @param partType
 * @returns {boolean}
 */
function isAttributeValid(partType) {
    return partType !== 'dstypes' && partType !== 'dsnames';
}

/**
 *
 * @param metrics
 * @returns {Buffer}
 */
exports.encode = function (metrics) {

    // TODO - provide size for better performance when concat
    var buffer = new Buffer(0);

    metrics.forEach(function (metric) {
        for (var partType in metric) {
            if (metric.hasOwnProperty(partType) && isAttributeValid(partType)) {

                var type = protocol.getTypeCodeFromName(partType);
                var encoder = getPartEncoder(partType);

                var resultBuffer;
                if (isValue(partType)) {
                    resultBuffer = encoder(metric.dstypes, metric.values);
                } else {
                    resultBuffer = encoder(type, metric[partType]);
                }

                buffer = Buffer.concat([buffer, resultBuffer]);
            }
        }
    });

    return buffer;
};