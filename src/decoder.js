'use strict';

var Readable = require('stream').Readable;
var util = require('util');
var Q = require('q');

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
    var deferred = Q.defer();

    setImmediate(function () {
        var type = ctype.ruint16(buffer, 'big', offset);
        var length = ctype.ruint16(buffer, 'big', offset + 2);

        return deferred.resolve({type: type, length: length});
    });
    return deferred.promise;
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
    var deferred = Q.defer();

    setImmediate(function () {
        var stringOffset = definition.HEADER_SIZE + offset;

        var decoded = '';
        for (var i = 0; i < (partLen - 5); i++) {
            decoded = decoded.concat(String.fromCharCode(ctype.rsint8(buffer, 'big', stringOffset)));
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
function getValueDecoder(valueType) {
    var decoder = [];

    decoder[definition.DS_TYPE_COUNTER] = decodeCounter;
    decoder[definition.DS_TYPE_DERIVE] = decodeDerive;
    decoder[definition.DS_TYPE_GAUGE] = decodeGauge;
    decoder[definition.DS_TYPE_ABSOLUTE] = decodeAbsolute;

    return decoder[valueType];
}

function pushDecodedValue(values, decoded) {
    values.values.push(decoded.value);
    values.dstypes.push(decoded.type);
    values.dsnames.push('value');
}

/**
 * Decodes the values part.
 *
 * @param buffer The buffer to use for decoding
 * @param offset The offset to start reading
 * @returns {{dstypes: Array, values: Array}} A decoded part
 */
function decodeValuesPart(buffer, offset) {
    var deferred = Q.defer();

    setImmediate(function () {
        var values = {dstypes: [], values: [], dsnames: []};

        // Decode values size
        decodeValuesSize(buffer, offset)
            .then(function (numberOfValues) {
                var typeOffset = offset + definition.HEADER_AND_LENGTH_SIZE;
                var valuesOffset = offset + definition.HEADER_AND_LENGTH_SIZE + numberOfValues;

                function decode(decoder) {
                    return decoder(buffer, valuesOffset);
                }

                function pushDecoded(decoded) {
                    pushDecodedValue(values, decoded);

                    typeOffset++;
                    valuesOffset += definition.VALUE_SIZE;

                    if (values.values.length === numberOfValues) {
                        deferred.resolve(values);
                    }
                }

                // Decode types
                for (var i = 0; i < numberOfValues; i++) {
                    decodeValueType(buffer, typeOffset)
                        .then(getValueDecoder)
                        .then(decode)
                        .then(pushDecoded);
                }
            });
    });
    return deferred.promise;
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
    var deferred = Q.defer();

    setImmediate(function() {
        var decoder = getPartDecoder(header.type);

        if (decoder === undefined) {
            deferred.reject(new Error('No handler for type ' + header.type));
        }

        decoder(buffer, offset, header.length)
            .then(function(wDecoded) {
                if (header.type === definition.TYPE_VALUES) {
                    addValuesToMetric(metric, wDecoded);
                    metrics.push(clone(metric));
                } else {
                    var typeName = converters.getTypeNameFromCode(header.type);

                    if (typeName === undefined) {
                        deferred.reject(new Error('No type name found for: ' + header.type));
                    }

                    addToMetric(metric, typeName, wDecoded);
                }
                deferred.resolve({metric: metric, metrics: metrics});
            });
    });
    return deferred.promise;
}

function Decoder(buffer) {
    if (!(this instanceof Decoder)) {
        return new Decoder(buffer);
    }

    Readable.call(this, {objectMode: true});

    this._metrics = [];
    this._metric = {};
    this._offset = 0;

    if(buffer !== undefined) {
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

            decodeHeader(this._buffer, this._offset)
                .then(function(header) {

                    if (header.length === 0) {
                        self.emit('error', new Error('Unable to decode. Invalid message?'));
                        return;
                    }

                    decodePart(self._metrics, self._metric, header, self._buffer, self._offset)
                        .then(function() {
                            self._offset += header.length;
                            self.push(self._metric);
                        });
                }, function (err) {
                    self.emit('error', err);
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