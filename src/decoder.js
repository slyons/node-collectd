'use strict';

var Readable = require('stream').Readable;
var util = require('util');
var Q = require('q');

var assign = require('lodash/assign');
var isUndefined = require('lodash/isUndefined');

var definition = require('./definition');
var converters = require('./converters');
var commonDecoder = require('./decoder/common-decoder');
var partDecoder = require('./decoder/part-decoder');
var customPartValidator = require('./custom-part-validator');

var customStringParts;

function addToMetric(metric, typeName, type) {
    metric[typeName] = type;
}

function addValuesToMetric(metric, values) {
    metric.dstypes = values.dstypes;
    metric.values = values.values;
    metric.dsnames = values.dsnames;
}

/**
 * Initializes a new metric before start decoding the metric.
 *
 * @param metricsArray The global metrics array
 * @returns {*} A new initialized metric
 */
function initializeMetric(metricsArray) {
    metricsArray.push({});
    return metricsArray[metricsArray.length - 1];
}

function isValueType(header) {
    return header.type === definition.TYPE_VALUES;
}

function isHostType(header) {
    return header.type === definition.TYPE_HOST;
}

/**
 * Returns true if the specified header type is a configured string part.
 *
 * @param headerType The header type to check
 * @returns {boolean} True if the custom part is configured, false otherwise
 */
function customStringPartIsConfigured(headerType) {
    return !isUndefined(customStringParts[headerType]);
}

/**
 * Returns a part decoder from the specified header type.
 *
 * @param headerType The header type to check
 */
function getPartDecoderFromHeaderType(headerType) {
    var decoder = partDecoder.getFromHeaderType(headerType);

    if (isUndefined(decoder)) {
        if (customStringPartIsConfigured(headerType)) {
            decoder = partDecoder.decodeStringPart;
        }
    }
    return decoder;
}

/**
 * Returns the type name from the specified header type.
 *
 * @param headerType The header type to check
 * @returns {*} A string representing the type name
 */
function getTypeNameFromHeaderType(headerType) {
    return converters.getTypeNameFromCode(headerType) || customStringParts[headerType];
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
    var deferred = Q.defer();

    setImmediate(function() {
        var decoder = getPartDecoderFromHeaderType(header.type);

        if (isUndefined(decoder)) {
            deferred.reject(new Error('No handler for type ' + header.type));
        } else {
            decoder(buffer, offset, header.length, metric)
                .then(function(decoded) {
                    if (isValueType(header)) {
                        addValuesToMetric(metric, decoded);
                    } else {
                        var typeName = getTypeNameFromHeaderType(header.type);
                        if (isUndefined(typeName)) {
                            deferred.reject(new Error('No type name found for: ' + header.type));
                            return;
                        }
                        addToMetric(metric, typeName, decoded);
                    }
                    deferred.resolve({metric: metric, metrics: metrics});
                });
        }
    });
    return deferred.promise;
}

/**
 * Returns true if the specified header is empty.
 *
 * @param header Thea header to check
 * @returns {boolean}
 */
function isHeaderEmpty(header) {
    return header.length === 0;
}

/**
 * Configures the passed custom parts to decode.
 *
 * @param customPartsConfig A custom parts configuration object
 */
function configureCustomParts(customPartsConfig) {
    var isValid = customPartValidator.validateCustomPartsConfig(customPartsConfig);

    if (isValid) {
        assign(customStringParts, customPartsConfig);
    } else {
        console.error('Invalid custom parts configuration: ' + customPartsConfig);
    }
}

function Decoder(buffer, customPartsConfig) {
    if (!(this instanceof Decoder)) {
        return new Decoder(buffer, customPartsConfig);
    }

    customStringParts = {};
    if (!isUndefined(customPartsConfig)) {
        configureCustomParts(customPartsConfig);
    }

    Readable.call(this, {objectMode: true});

    this._metrics = [];
    this._metric = {};
    this._offset = 0;

    if (buffer !== undefined) {
        this._bufferLength = buffer.length;
        this._buffer = buffer;
    } else {
        this.push(null);
    }
}

util.inherits(Decoder, Readable);
Decoder.prototype._read = function() {
    try {
        if (this._offset < this._bufferLength) {
            var self = this;

            commonDecoder.decodeHeader(this._buffer, this._offset)
                .then(function(header) {
                    if (isHeaderEmpty(header)) {
                        self.emit('error', new Error('Unable to decode. Invalid message?'));
                        return;
                    }

                    if (isHostType(header)) {
                        self._metric = initializeMetric(self._metrics);
                    }

                    decodePart(self._metrics, self._metric, header, self._buffer, self._offset)
                        .then(function() {
                            self._offset += header.length;
                            self.push(self._metric);
                        }, function (err) {
                            self.emit('error', err);
                        });
                });
        } else {
            this.push(this._metrics);
            this.push(null);
        }
    } catch (err) {
        this.emit('error', err);
    }
};

/**
 * Decodes a buffer of collectd metrics encoded in the binary protocol. Please reference to:
 * {@link https://collectd.org/wiki/index.php/Binary_protocol}
 *
 * @param buffer The buffer to use for decoding
 * @returns {Stream} An array of decoded collectd metrics.
 */
exports.decode = function(buffer) {
    return new Decoder(buffer);
};

/**
 *
 * @param buffer
 * @param customPartsConfig
 * @returns {Decoder}
 */
exports.decodeCustom = function (buffer, customPartsConfig) {
    return new Decoder(buffer, customPartsConfig);
};