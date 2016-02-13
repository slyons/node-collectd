'use strict';

var protocol = require('./definition');

/**
 *
 * @param type
 * @param len
 * @returns {*[]}
 */
function buildHeader(type, len) {
    return [[type, protocol.HEADER_SIZE + len]];
}

/**
 *
 * @param type
 * @param partBuffer
 * @param headerSize
 */
function encodeHeader(type, partBuffer, headerSize) {
    var header = buildHeader(type, headerSize);
    protocol.bigParser.writeData(protocol.headerDefinition, partBuffer, 0, header);
}

/**
 *
 * @param string
 * @returns {*[]}
 */
function buildStringTypeBuffer(string) {
    var hostBuffer = new Buffer(string.length + protocol.NULL_BYTE_SIZE);
    hostBuffer.write(string + '\0');
    return [hostBuffer];
}

/**
 *
 * @param partBuffer
 * @param string
 * @param stringSize
 */
function encodeStringPart(partBuffer, string, stringSize) {
    var value = buildStringTypeBuffer(string);
    var definition = protocol.buildStringTypeDefinition(stringSize);
    protocol.bigParser.writeData(definition, partBuffer, protocol.HEADER_SIZE, value);
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
    encodeStringPart(partBuffer, string, stringSize);

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
    var hexValue = Math.abs(value).toString(16);
    if (hexValue.length < 16) {
        var zeros = new Array(16 - hexValue.length);
        zeros.fill(0);
        hexValue = zeros.join('').concat(hexValue);
    }

    var lhs = parseInt(hexValue.substring(0, 8), 16);
    var rhs = parseInt(hexValue.substring(8, 16), 16);

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
    protocol.bigParser.writeData(
        protocol.numericDefinition, partBuffer, protocol.HEADER_SIZE, [int64ToHexArray(value)]);
}

/**
 *
 * @param type
 * @param value
 * @returns {Buffer}
 */
function encodeNumeric(type, value) {
    var partBuffer = new Buffer(protocol.HEADER_SIZE + protocol.NUM_PART_SIZE);

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
        type: [protocol.DS_TYPE_COUNTER],
        definition: protocol.counterDefinition,
        endian: 'big',
        value: [int64ToHexArray(value)]
    };
}

/**
 *
 * @param value
 * @returns {{type: *[], definition: (exports.gaugeDefinition|*), endian: string, value: *[]}}
 */
function getGaugeDefinition(value) {
    return {
        type: [protocol.DS_TYPE_GAUGE],
        definition: protocol.gaugeDefinition,
        endian: 'little',
        value: [value]
    };
}

/**
 *
 * @param value
 * @returns {{type: *[], definition: (exports.deriveDefinition|*), endian: string, value: *[]}}
 */
function getDeriveDefinition(value) {
    return {
        type: [protocol.DS_TYPE_DERIVE],
        definition: protocol.deriveDefinition,
        endian: 'big',
        value: [int64ToHexArray(value)]
    };
}

/**
 *
 * @param value
 * @returns {{type: *[], definition: (exports.absoluteDefinition|*), endian: string, value: *[]}}
 */
function getAbsoluteDefinition(value) {
    return {
        type: [protocol.DS_TYPE_ABSOLUTE],
        definition: protocol.absoluteDefinition,
        endian: 'big',
        value: [int64ToHexArray(value)]
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
    protocol.bigParser.writeData(protocol.valuesSizeDefinition, partBuffer, protocol.HEADER_SIZE, [valuesSize]);
}

/**
 *
 * @param partBuffer
 * @param offset
 * @param type
 */
function encodeType(partBuffer, offset, type) {
    protocol.bigParser.writeData(protocol.valueTypeDefinition, partBuffer, offset, type);
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
    if (typeDef.endian === 'little') {
        protocol.littleParser.writeData(definition, partBuffer, offset, value);
    } else {
        protocol.bigParser.writeData(definition, partBuffer, offset, value);
    }
}

/**
 *
 * @param dstypes
 * @param values
 * @returns {Buffer}
 */
function encodeValuesPart(dstypes, values) {
    var payloadSize = values.length * (protocol.VALUE_NUMBER_SIZE + protocol.VALUE_SIZE);
    var partBuffer = new Buffer(protocol.HEADER_SIZE + protocol.LENGTH_SIZE + payloadSize);

    encodeHeader(protocol.TYPE_VALUES, partBuffer, protocol.LENGTH_SIZE + payloadSize);
    encodeValuesSize(partBuffer, values.length);

    var numberOfValues = dstypes.length;

    var typeOffset = protocol.HEADER_SIZE + protocol.LENGTH_SIZE;
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
    return partType !== 'dstypes' && partType !== 'dsnames'
}

/**
 *
 * @param metric
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
                console.log(partType);
                console.log(encoder);

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