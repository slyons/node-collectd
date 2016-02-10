'use strict';

/**
 * Utilities for parsing the CollectD binary format. Adapted from the Python version by Adrian Perez.
 */
var clone = require('lodash/clone');
var assign = require('lodash/assign');

var Parser = require("ctype").Parser;
var ctype = require("ctype");

// Message kinds
var TYPE_HOST            = 0x0000;
var TYPE_TIME            = 0x0001;
var TYPE_PLUGIN          = 0x0002;
var TYPE_PLUGIN_INSTANCE = 0x0003;
var TYPE_TYPE            = 0x0004;
var TYPE_TYPE_INSTANCE   = 0x0005;
var TYPE_VALUES          = 0x0006;
var TYPE_INTERVAL        = 0x0007;
var TYPE_TIME_HIRES      = 0x0008;
var TYPE_INTERVAL_HIRES  = 0x0009;

// For notifications
var TYPE_MESSAGE         = 0x0100;
var TYPE_SEVERITY        = 0x0101;

// DS kinds
var DS_TYPE_COUNTER      = 0;
var DS_TYPE_GAUGE        = 1;
var DS_TYPE_DERIVE       = 2;
var DS_TYPE_ABSOLUTE     = 3;

/**
 * Collectd packets consist of parts, with each part starting with a 16 bit TYPE field, followed by a 16 bit LENGTH field. The length is the length of the part including the TYPE and LENGTH fields.
 */
var headerPacket = [{type: {type: 'uint16_t'}}, {length: {type: 'uint16_t'}}];
var ctypeParser = new Parser({endian: "big"});

function to64(val) {
    // Until I get around to writing a native extension, this will have to do
    try {
        return ctype.toAbs64(val);
    } catch (e) {
        return ctype.toApprox64(val);
    }
}

/**
 * Strings are by far the easiest thing to parse. Just the LENGTH - 4 bytes of characters, and that includes the null terminator.
 */
function decode_network_string(buf, len) {
    // This syntax is a bit strange, but it boils down to "Read a string of <len> length and return it in a field named 'content'"
    var nstring = ctypeParser.readData([{content: {type: "char[" + len + "]"}}], buf, 4);
    return nstring.content.toString("ascii", 0, len - 1);
}

/**
 * Numbers (which describe a few different part types) are just 64 bit big endian encoded.
 */
function decode_network_number(buf) {
    var nnumber = ctype.rsint64(buf, "big", 4);
    return to64(nnumber);
}

/**
 * Values are defined by a subtype, which is described in types.db
 */
function decode_network_values(buf) {
    var value_count = ctype.ruint16(buf, "big", 4);
    var results = [];
    var value_types = [];
    var offset = 6;
    var data_offset = offset + value_count;

    for (var i = 0; i < value_count; i++) {
        value_types.push(ctype.ruint8(buf, "big", offset + i));
    }

    var dsnames = [];
    var dstypes = [];
    var values = [];

    for (var index = 0; index < value_types.length; index++) {
        switch (value_types[index]) {
            case DS_TYPE_COUNTER:
                values.push(to64(ctype.ruint64(buf, "big", data_offset + (8 * index))));
                dstypes.push('counter');
                break;
            case DS_TYPE_ABSOLUTE:
                values.push(to64(ctype.ruint64(buf, "big", data_offset + (8 * index))));
                dstypes.push('absolute');
                break;
            case DS_TYPE_GAUGE:
                values.push(ctype.rdouble(buf, "little", data_offset + (8 * index)));
                dstypes.push('gauge');
                break;
            case DS_TYPE_DERIVE:
                values.push(to64(ctype.rsint64(buf, "big", data_offset + (8 * index))));
                dstypes.push('derive');
                break;
            default:
                console.log("Sorry, can't handle variable type " + value_types[index]);
                continue;
        }

        dsnames.push('value');
        results.push({dstypes: dstypes, values: values, dsnames: dsnames});
    }

    return results;
}

// Ugly and very much cribbed from the Python version
var decoders = [];
decoders[TYPE_HOST] = decode_network_string;
decoders[TYPE_PLUGIN] = decode_network_string;
decoders[TYPE_PLUGIN] = decode_network_string;
decoders[TYPE_PLUGIN_INSTANCE] = decode_network_string;
decoders[TYPE_TYPE] = decode_network_string;
decoders[TYPE_TYPE_INSTANCE] = decode_network_string;
decoders[TYPE_MESSAGE] = decode_network_string;
decoders[TYPE_TIME] = decode_network_number;
decoders[TYPE_INTERVAL] = decode_network_number;
decoders[TYPE_SEVERITY] = decode_network_number;
decoders[TYPE_TIME_HIRES] = decode_network_number;
decoders[TYPE_VALUES] = decode_network_values;
decoders[TYPE_INTERVAL_HIRES] = decode_network_number;

function convertFromHighResolution(number) {
    return number / 1000000000;
}

/**
 * Convert from the flat type->value array to something more object-based
 *
 * @param results An array of decoded results
 * @returns {Array}
 */
function interpret_results(results) {
    var val_objects = [];
    var v = {};

    results.forEach(function (result) {
        switch (result.type) {
            case TYPE_TIME:
                if (!v.time) {
                    v.time = result.value;
                }
                break;
            case TYPE_TIME_HIRES:
                if (!v.time) {
                    v.time = convertFromHighResolution(result.value);
                }
                break;
            case TYPE_INTERVAL:
                if (!v.interval) {
                    v.interval = result.value;
                }
                break;
            case TYPE_INTERVAL_HIRES:
                if (!v.interval) {
                    v.interval = convertFromHighResolution(result.value);
                }
                break;
            case TYPE_HOST:
                v.host = result.value;
                break;
            case TYPE_PLUGIN:
                v.plugin = result.value;
                break;
            case TYPE_PLUGIN_INSTANCE:
                v.plugin_instance = result.value;
                break;
            case TYPE_TYPE:
                v.type = result.value;
                break;
            case TYPE_TYPE_INSTANCE:
                v.type_instance = result.value;
                break;
            case TYPE_VALUES:
                assign(v, result.value[0]);
                val_objects.push(clone(v));
                break;
            case TYPE_MESSAGE:
                v.message = result.value;
                break;
            case TYPE_SEVERITY:
                // ignore fo now
                break;
        }
    });

    return val_objects;
}

exports.decode = function (buf) {
    var results = [];
    var offset = 0, buffer_length = buf.length;

    while (offset < buffer_length) {
        var header = ctypeParser.readData(headerPacket, buf, offset);

        var decoder = decoders[header.type];
        if (undefined !== decoder) {
            var value = decoder(buf.slice(offset, offset + header.length), header.length - 4, header.type);
            results.push({type: header.type, value: value});
        } else {
            console.error("No handler for type " + header.type);
        }

        if (header.length === 0) {
            console.error("Unable to decode. Invalid message?");
            break;
        }

        offset += header.length;
    }
    return interpret_results(results);
};