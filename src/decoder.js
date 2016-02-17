'use strict';

var clone = require('lodash/clone');
var ctype = require('ctype');
var definition = require('./definition');
var converters = require('./converters');

/**
 * Decodes the part header.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{type: number, length: number}} A decoded header
 */
function decodeHeader(buffer, offset) {
    var type = ctype.ruint16(buffer, 'big', offset);
    var length = ctype.ruint16(buffer, 'big', offset + 2);

    return {type: type, length: length};
}

/**
 * Decodes a part with string format
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @param partLen The size of the part
 * @returns {string} The decoded string
 */
function decodeStringPart(buffer, offset, partLen) {
    var stringOffset = definition.HEADER_SIZE + offset;

    var decoded = '';
    for (var i = 0; i < (partLen - 5); i++) {
        decoded = decoded.concat(String.fromCharCode(ctype.rsint8(buffer, 'big', stringOffset)));
        stringOffset++;
    }

    return decoded;
}

/**
 * Decodes a part with numeric format.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {number} The decoded number
 */
function decodeNumericPart(buffer, offset) {
    return converters.to64(ctype.rsint64(buffer, 'big', definition.HEADER_SIZE + offset));
}

/**
 * Decodes a part encoded in a high resolution number format.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {number} The decoded number
 */
function decodeHighResolutionPart(buffer, offset) {
    var highResolution =  decodeNumericPart(buffer, offset);
    return converters.toLowResolution(highResolution);
}

/**
 * Decodes the number of values contained in a metric, encoded after the header.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {number} The number of values in a values part
 */
function decodeValuesSize(buffer, offset) {
    return ctype.ruint16(buffer, 'big', offset + definition.HEADER_SIZE);
}

/**
 * Decodes the value type ('host', 'time', etc.).
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {number} The type code
 */
function decodeValueType(buffer, offset) {
    return ctype.ruint8(buffer, 'big', offset);
}

/**
 * Decodes a counter value.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{value: number, type: string}} The decoded counter
 */
function decodeCounter(buffer, offset) {
    var counter = ctype.ruint64(buffer, 'big', offset);
    return {value: converters.to64(counter), type: 'counter'};
}

/**
 * Decodes a derive value.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{value: number, type: string}} The decoded derive
 */
function decodeDerive(buffer, offset) {
    var derive = ctype.rsint64(buffer, 'big', offset);
    return {value: converters.to64(derive), type: 'derive'};
}

/**
 * Decodes a gauge value.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{value: number, type: string}} The gauge counter
 */
function decodeGauge(buffer, offset) {
    var gauge = ctype.rdouble(buffer, 'little', offset);
    return {value: gauge, type: 'gauge'};
}

/**
 * Decodes an absolute value.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{value: number, type: string}} The decoded absolute
 */
function decodeAbsolute(buffer, offset) {
    var absolute = ctype.ruint64(buffer, 'big', offset);
    return {value: converters.to64(absolute), type: 'absolute'};
}

/**
 * Returns the decoder for the passed value type.
 *
 * @param valueType The value type
 * @returns {*} A value decoder (counter, derive, gauge or absolute)
 */
function getValueDecoder(valueType) {
    var decoder = [];

    decoder[definition.DS_TYPE_COUNTER] = decodeCounter;
    decoder[definition.DS_TYPE_DERIVE] = decodeDerive;
    decoder[definition.DS_TYPE_GAUGE] = decodeGauge;
    decoder[definition.DS_TYPE_ABSOLUTE] = decodeAbsolute;

    return decoder[valueType];
}

/**
 * Decodes the values part.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{dstypes: Array, values: Array}} A decoded part
 */
function decodeValuesPart(buffer, offset) {
    var values = {dstypes: [], values: [], dsnames: []};

    // Decode values size
    var numberOfValues = decodeValuesSize(buffer, offset);

    var typeOffset = offset + definition.HEADER_AND_LENGTH_SIZE;
    var valuesOffset = offset + definition.HEADER_AND_LENGTH_SIZE + numberOfValues;

    // Decode types
    for (var i = 0; i < numberOfValues; i++) {
        var valueType = decodeValueType(buffer, typeOffset);

        var decoder = getValueDecoder(valueType);
        var decoded = decoder(buffer, valuesOffset);
        values.values.push(decoded.value);
        values.dstypes.push(decoded.type);
        values.dsnames.push('value');

        typeOffset++;
        valuesOffset += definition.VALUE_SIZE;
    }

    return values;
}

function addToMetric(metric, typeName, type) {
    metric[typeName] = type;
}

function addValuesToMetric(metric, values) {
    metric.dstypes = values.dstypes;
    metric.values = values.values;
    metric.dsnames = values.dsnames;
}

/**
 * Returns a parts decoder based on the passed part type.
 *
 * @param partType The part type code
 * @returns {*} A parts decoder
 */
function getPartDecoder(partType) {
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

/**
 * Decodes a specific part and eventually adds the decoded part to the metrics array.
 *
 * @param metrics An array of metrics (to construct)
 * @param metric The metric being constructed
 * @param header The decoded header to help decode the part body
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 */
function decodePart(metrics, metric, header, buffer, offset) {
    var decoder = getPartDecoder(header.type);

    if (decoder === undefined) {
        throw (new Error('No handler for type ' + header.type));
    }

    var decoded = decoder(buffer, offset, header.length);
    if (header.type === definition.TYPE_VALUES) {
        addValuesToMetric(metric, decoded);
        metrics.push(clone(metric));
    } else {
        var typeName = converters.getTypeNameFromCode(header.type);

        if (typeName === undefined) {
            throw (new Error('No type name found for: ' + header.type));
        }

        addToMetric(metric, typeName, decoded);
    }
}

/**
 * Decodes a buffer of collectd metrics encoded in the binary protocol. Please reference to:
 * {@link https://collectd.org/wiki/index.php/Binary_protocol}
 *
 * @param buffer The buffer to use for decoding
 * @returns {Array} An array of decoded collectd metrics.
 */
exports.decode = function (buffer) {
    try {
        var metrics = [];

        var offset = 0;
        var bufferLength = buffer.length;

        var metric = {};
        while (offset < bufferLength) {
            var header = decodeHeader(buffer, offset);
            decodePart(metrics, metric, header, buffer, offset);

            if (header.length === 0) {
                console.error("Unable to decode. Invalid message?");
                break;
            }

            offset += header.length;
        }
        return metrics;
    } catch (err) {
        console.error(err);
    }
};