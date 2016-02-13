'use strict';

var clone = require('lodash/clone');
var ctype = require('ctype');
var protocol = require('./definition');

var HIGH_RESOLUTION_DIVIDER = 1000000000;

/**
 *
 * @param buffer
 * @param offset
 * @returns {*}
 */
function decodeHeader(buffer, offset) {
    return protocol.bigParser.readData(protocol.headerDefinition, buffer, offset).header;
}

/**
 *
 * @param buffer
 * @param offset
 * @param partLen
 * @returns {string}
 */
function decodeStringPart(buffer, offset, partLen) {
    var definition = protocol.buildStringTypeDefinition(partLen - protocol.HEADER_SIZE);
    var decoded = protocol.bigParser.readData(definition, buffer, protocol.HEADER_SIZE + offset).value.toString();
    return decoded.substring(0, decoded.length - 1);
}

/**
 *
 * @param val
 * @returns {*}
 */
function to64(val) {
    // Until I get around to writing a native extension, this will have to do
    try {
        return ctype.toAbs64(val);
    } catch (e) {
        return ctype.toApprox64(val);
    }
}

/**
 *
 * @param buffer
 * @param offset
 * @returns {*}
 */
function decodeNumericPart(buffer, offset) {
    return to64(protocol.bigParser.readData(protocol.numericDefinition, buffer, protocol.HEADER_SIZE + offset).value);
}

/**
 *
 * @param buffer
 * @param offset
 * @returns {number}
 */
function decodeHighResolutionPart(buffer, offset) {
    return decodeNumericPart(buffer, offset) / HIGH_RESOLUTION_DIVIDER;
}

/**
 *
 * @param buffer
 * @param offset
 * @returns {*}
 */
function decodeValuesSize(buffer, offset) {
    return protocol.bigParser.readData(protocol.valuesSizeDefinition, buffer, offset + protocol.HEADER_SIZE).value;
}

/**
 *
 * @param buffer
 * @param offset
 * @returns {*}
 */
function decodeValueType(buffer, offset) {
    return protocol.bigParser.readData(protocol.valueTypeDefinition, buffer, offset).value;
}

/**
 *
 * @param buffer
 * @param offset
 * @returns {{value: *, type: string}}
 */
function decodeCounter(buffer, offset) {
    var counter = protocol.bigParser.readData(protocol.counterDefinition, buffer, offset).value;
    return {value: to64(counter), type: 'counter'};
}

/**
 *
 * @param buffer
 * @param offset
 * @returns {{value: *, type: string}}
 */
function decodeDerive(buffer, offset) {
    var derive = protocol.bigParser.readData(protocol.deriveDefinition, buffer, offset).value;
    return {value: to64(derive), type: 'derive'};
}

/**
 *
 * @param buffer
 * @param offset
 * @returns {{value: *, type: string}}
 */
function decodeGauge(buffer, offset) {
    var gauge = protocol.littleParser.readData(protocol.gaugeDefinition, buffer, offset).value;
    return {value: gauge, type: 'gauge'};
}

/**
 *
 * @param buffer
 * @param offset
 * @returns {{value: *, type: string}}
 */
function decodeAbsolute(buffer, offset) {
    var absolute = protocol.bigParser.readData(protocol.absoluteDefinition, buffer, offset).value;
    return {value: to64(absolute), type: 'absolute'};
}

/**
 *
 * @param valueType
 * @returns {*}
 */
function getValueDecoder(valueType) {
    var decoder = [];

    decoder[protocol.DS_TYPE_COUNTER] = decodeCounter;
    decoder[protocol.DS_TYPE_DERIVE] = decodeDerive;
    decoder[protocol.DS_TYPE_GAUGE] = decodeGauge;
    decoder[protocol.DS_TYPE_ABSOLUTE] = decodeAbsolute;

    return decoder[valueType];
}

/**
 *
 * @param buffer
 * @param offset
 * @returns {{dstypes: Array, values: Array}}
 */
function decodeValuesPart(buffer, offset) {
    var values = {dstypes: [], values: [], dsnames: []};

    // Decode values size
    var numberOfValues = decodeValuesSize(buffer, offset);

    var typeOffset = offset + protocol.HEADER_SIZE + protocol.LENGTH_SIZE;
    var valuesOffset = offset + protocol.HEADER_SIZE + protocol.LENGTH_SIZE + numberOfValues;

    // Decode types
    for (var i = 0; i < numberOfValues; i++) {
        var valueType = decodeValueType(buffer, typeOffset);

        var decoder = getValueDecoder(valueType);
        var decoded = decoder(buffer, valuesOffset);
        values.values.push(decoded.value);
        values.dstypes.push(decoded.type);
        values.dsnames.push('value');

        typeOffset++;
        valuesOffset += 8;
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

function getPartDecoder(partType) {
    var decoders = [];

    decoders[protocol.TYPE_HOST] = decodeStringPart;
    decoders[protocol.TYPE_PLUGIN] = decodeStringPart;
    decoders[protocol.TYPE_PLUGIN_INSTANCE] = decodeStringPart;
    decoders[protocol.TYPE_TYPE] = decodeStringPart;
    decoders[protocol.TYPE_TYPE_INSTANCE] = decodeStringPart;
    decoders[protocol.TYPE_MESSAGE] = decodeStringPart;
    decoders[protocol.TYPE_TIME] = decodeNumericPart;
    decoders[protocol.TYPE_TIME_HIRES] = decodeHighResolutionPart;
    decoders[protocol.TYPE_INTERVAL] = decodeNumericPart;
    decoders[protocol.TYPE_INTERVAL_HIRES] = decodeHighResolutionPart;
    decoders[protocol.TYPE_SEVERITY] = decodeNumericPart;
    decoders[protocol.TYPE_VALUES] = decodeValuesPart;

    return decoders[partType];
}

/**
 *
 * @param buffer
 * @returns {Array}
 */
exports.decode = function (buffer) {
    var metrics = [];

    var offset = 0;
    var bufferLength = buffer.length;

    var metric = {};
    while (offset < bufferLength) {
        // Decode the header
        var header = decodeHeader(buffer, offset);

        var decoder = getPartDecoder(header.type);
        var decoded = decoder(buffer, offset, header.length);

        if (header.type === protocol.TYPE_VALUES) {
            addValuesToMetric(metric, decoded);
            metrics.push(clone(metric));
        } else {
            var typeName = protocol.getTypeNameFromCode(header.type);
            addToMetric(metric, typeName, decoded);
        }

        offset += header.length;
    }

    return metrics;
};