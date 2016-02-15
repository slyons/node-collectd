'use strict';

var ctype = require('ctype');
var definition = require('./definition');

/**
 * Adds a sign to the passed value.
 *
 * @param value The value to assign a sign
 * @returns {number} The signed value
 */
function addSign(value) {
    return 0 - value;
}

/**
 * Returns an array with and approximate representation for the passed 64 bits integer. Values greater than
 * Number.MAX_SAFE_INTEGER and lesser than Number.MIN_SAFE_INTEGER will have their values as an approximate to the
 * passed value.
 *
 * @param value The 64 bits value to convert
 * @returns {*[]} An array with the most significant 32 bits on the first position and least significant 32 bits on
 *                the second position
 */
function approximateInt64ToHexArray(value) {
    if (value > definition.MAX_SUPPORTED_INT) {
        throw (new Error('Value is greater than max integer: ' + value));
    }

    if (value < definition.MIN_SUPPORTED_INT) {
        throw (new Error('Value is smaller than min integer: ' + value));
    }

    var hexValue = Math.abs(value).toString(16);
    if (hexValue.length < definition.MAX_BYTES) {
        var zeros = new Array(definition.MAX_BYTES - hexValue.length);
        zeros.fill(0);
        hexValue = zeros.join('').concat(hexValue);
    }

    var lhs = parseInt(hexValue.substring(0, definition.HALF_BYTES), 16);
    var rhs = parseInt(hexValue.substring(definition.HALF_BYTES, definition.MAX_BYTES), 16);

    if (value < 0) {
        return [addSign(lhs), addSign(rhs)];
    } else {
        return [lhs, rhs];
    }
}

/**
 * Converts an array with 64 bits: most significant 32 bits on the first position and the least significant 32 bits
 * on the second position. Values greater than Number.MAX_SAFE_INTEGER and lesser than Number.MIN_SAFE_INTEGER will
 * have their values as an approximation.
 *
 * @param array The array with two elements containing 32 bits each
 * @returns {*} A approximate number, depending on the precision
 */
function to64(array) {
    // Until I get around to writing a native extension, this will have to do
    try {
        return ctype.toAbs64(array);
    } catch (e) {
        return ctype.toApprox64(array);
    }
}

/**
 * Converts an High Resolution number to low resolution. This is equivalent of shifting 30 bits of 64 to the right.
 *
 * @param highResolution The high resolution value to convert
 * @returns {*}
 */
function toLowResolution(highResolution) {
    var hexArray = approximateInt64ToHexArray(highResolution);

    var lhs1 = hexArray[0] << 2;
    var lhs2 = hexArray[1] >>> 30;

    var rhs = hexArray[0] >>> 30;
    var lhs = lhs1 | lhs2;

    return to64([rhs, lhs]);
}

/**
 * Returns the part type code from the part type name.
 *
 * @param typeName The name code
 * @returns {*} The code of the part type
 */
function getTypeCodeFromName(typeName) {
    var codes = [];

    codes['host'] = definition.TYPE_HOST;
    codes['plugin'] = definition.TYPE_PLUGIN;
    codes['plugin_instance'] = definition.TYPE_PLUGIN_INSTANCE;
    codes['type'] = definition.TYPE_TYPE;
    codes['type_instance'] = definition.TYPE_TYPE_INSTANCE;
    codes['message'] = definition.TYPE_MESSAGE;
    codes['time'] = definition.TYPE_TIME;
    codes['time_hires'] = definition.TYPE_TIME_HIRES;
    codes['interval'] = definition.TYPE_INTERVAL;
    codes['interval_hires'] = definition.TYPE_INTERVAL_HIRES;
    codes['severity'] = definition.TYPE_SEVERITY;
    codes['values'] = definition.TYPE_VALUES;

    return codes[typeName];
}

/**
 * Returns the part type name from the part type code.
 *
 * @param typeCode The part name
 * @returns {*} The part code name
 */
function getTypeNameFromCode(typeCode) {
    var types = [];

    types[definition.TYPE_HOST] = 'host';
    types[definition.TYPE_PLUGIN] = 'plugin';
    types[definition.TYPE_PLUGIN_INSTANCE] = 'plugin_instance';
    types[definition.TYPE_TYPE] = 'type';
    types[definition.TYPE_TYPE_INSTANCE] = 'type_instance';
    types[definition.TYPE_MESSAGE] = 'message';
    types[definition.TYPE_TIME] = 'time';
    types[definition.TYPE_TIME_HIRES] = 'time';
    types[definition.TYPE_INTERVAL] = 'interval';
    types[definition.TYPE_INTERVAL_HIRES] = 'interval';
    types[definition.TYPE_SEVERITY] = 'severity';
    types[definition.TYPE_VALUES] = 'values';

    return types[typeCode];
}

exports.approximateInt64ToHexArray = approximateInt64ToHexArray;
exports.to64 = to64;
exports.toLowResolution = toLowResolution;
exports.getTypeCodeFromName = getTypeCodeFromName;
exports.getTypeNameFromCode = getTypeNameFromCode;
