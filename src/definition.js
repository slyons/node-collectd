'use strict';

// Message kinds
var TYPE_HOST = 0x0000;
var TYPE_TIME = 0x0001;
var TYPE_PLUGIN = 0x0002;
var TYPE_PLUGIN_INSTANCE = 0x0003;
var TYPE_TYPE = 0x0004;
var TYPE_TYPE_INSTANCE = 0x0005;
var TYPE_VALUES = 0x0006;
var TYPE_INTERVAL = 0x0007;
var TYPE_TIME_HIRES = 0x0008;
var TYPE_INTERVAL_HIRES = 0x0009;

// For notifications
var TYPE_MESSAGE = 0x0100;
var TYPE_SEVERITY = 0x0101;

// DS kinds
var DS_TYPE_COUNTER = 0;
var DS_TYPE_GAUGE = 1;
var DS_TYPE_DERIVE = 2;
var DS_TYPE_ABSOLUTE = 3;

// Sizes
var HEADER_SIZE = 4;
var LENGTH_SIZE = 2;
var NULL_BYTE_SIZE = 1;
var NUM_PART_SIZE = 12;
var VALUE_NUMBER_SIZE = 2;
var VALUE_SIZE = 8;

// Combined sizes
var HEADER_AND_LENGTH_SIZE = HEADER_SIZE + LENGTH_SIZE;
var VALUE_NUMBER_AND_VALUE_SIZE = VALUE_NUMBER_SIZE + VALUE_SIZE;
var HEADER_AND_NUM_PART_SIZE = HEADER_SIZE + NUM_PART_SIZE;

var MAX_BYTES = 16;
var HALF_BYTES = 8;

exports.TYPE_HOST = TYPE_HOST;
exports.TYPE_TIME = TYPE_TIME;
exports.TYPE_PLUGIN = TYPE_PLUGIN;
exports.TYPE_PLUGIN_INSTANCE = TYPE_PLUGIN_INSTANCE;
exports.TYPE_TYPE = TYPE_TYPE;
exports.TYPE_TYPE_INSTANCE = TYPE_TYPE_INSTANCE;
exports.TYPE_VALUES = TYPE_VALUES;
exports.TYPE_INTERVAL = TYPE_INTERVAL;
exports.TYPE_TIME_HIRES = TYPE_TIME_HIRES;
exports.TYPE_INTERVAL_HIRES = TYPE_INTERVAL_HIRES;
exports.TYPE_MESSAGE = TYPE_MESSAGE;
exports.TYPE_SEVERITY = TYPE_SEVERITY;
exports.DS_TYPE_COUNTER = DS_TYPE_COUNTER;
exports.DS_TYPE_GAUGE = DS_TYPE_GAUGE;
exports.DS_TYPE_DERIVE = DS_TYPE_DERIVE;
exports.DS_TYPE_ABSOLUTE = DS_TYPE_ABSOLUTE;
exports.HEADER_SIZE = HEADER_SIZE;
exports.LENGTH_SIZE = LENGTH_SIZE;
exports.NULL_BYTE_SIZE = NULL_BYTE_SIZE;
exports.NUM_PART_SIZE = NUM_PART_SIZE;
exports.VALUE_NUMBER_SIZE = VALUE_NUMBER_SIZE;
exports.VALUE_SIZE = VALUE_SIZE;
exports.HEADER_AND_LENGTH_SIZE = HEADER_AND_LENGTH_SIZE;
exports.VALUE_NUMBER_AND_VALUE_SIZE = VALUE_NUMBER_AND_VALUE_SIZE;
exports.HEADER_AND_NUM_PART_SIZE = HEADER_AND_NUM_PART_SIZE;
exports.MAX_BYTES = MAX_BYTES;
exports.HALF_BYTES = HALF_BYTES;

/**
 *
 * @param typeCode
 * @returns {*}
 */
exports.getTypeCodeFromName = function (typeCode) {
    var codes = [];

    codes['host'] = TYPE_HOST;
    codes['plugin'] = TYPE_PLUGIN;
    codes['plugin_instance'] = TYPE_PLUGIN_INSTANCE;
    codes['type'] = TYPE_TYPE;
    codes['type_instance'] = TYPE_TYPE_INSTANCE;
    codes['message'] = TYPE_MESSAGE;
    codes['time'] = TYPE_TIME;
    codes['time_hires'] = TYPE_TIME_HIRES;
    codes['interval'] = TYPE_INTERVAL;
    codes['interval_hires'] = TYPE_INTERVAL_HIRES;
    codes['severity'] = TYPE_SEVERITY;
    codes['values'] = TYPE_VALUES;

    return codes[typeCode];
};

/**
 *
 * @param typeName
 * @returns {*}
 */
exports.getTypeNameFromCode = function (typeName) {
    var types = [];

    types[TYPE_HOST] = 'host';
    types[TYPE_PLUGIN] = 'plugin';
    types[TYPE_PLUGIN_INSTANCE] = 'plugin_instance';
    types[TYPE_TYPE] = 'type';
    types[TYPE_TYPE_INSTANCE] = 'type_instance';
    types[TYPE_MESSAGE] = 'message';
    types[TYPE_TIME] = 'time';
    types[TYPE_TIME_HIRES] = 'time';
    types[TYPE_INTERVAL] = 'interval';
    types[TYPE_INTERVAL_HIRES] = 'interval';
    types[TYPE_SEVERITY] = 'severity';
    types[TYPE_VALUES] = 'values';

    return types[typeName];
};