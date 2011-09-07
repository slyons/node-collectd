/**
    protocol.js
    
    Utilities for parsing the CollectD binary format. Adapted from the Python version by Adrian Perez.
**/

var Parser = require("ctype").Parser;
var ctype = require("ctype");

// Message kinds
TYPE_HOST            = 0x0000;
TYPE_TIME            = 0x0001;
TYPE_PLUGIN          = 0x0002;
TYPE_PLUGIN_INSTANCE = 0x0003;
TYPE_TYPE            = 0x0004;
TYPE_TYPE_INSTANCE   = 0x0005;
TYPE_VALUES          = 0x0006;
TYPE_INTERVAL        = 0x0007;
TYPE_TIME_HIRES      = 0x0008;
TYPE_INTERVAL_HIRES  = 0x0009;

// For notifications
TYPE_MESSAGE         = 0x0100;
TYPE_SEVERITY        = 0x0101;

// DS kinds
DS_TYPE_COUNTER      = 0;
DS_TYPE_GAUGE        = 1;
DS_TYPE_DERIVE       = 2;
DS_TYPE_ABSOLUTE     = 3;

/**
    Collectd packets consist of parts, with each part starting with a 16 bit TYPE field, followed by a 16 bit LENGTH field. The length is the length of the part including the TYPE and LENGTH fields.
**/
headerPacket = [ { type: { type: 'uint16_t'}}, {length: {type: 'uint16_t'}}]

var ctypeParser = new Parser({endian:"big"});

// NOTE: The following is borrowed from node-ctype since it doesn't export them.
/*
 * Attempts to convert an array of two integers returned from rsint64 / ruint64
 * into an absolute 64 bit number. If however the value would exceed 2^52 this
 * will instead throw an error. The mantissa in a double is a 52 bit number and
 * rather than potentially give you a value that is an approximation this will
 * error. If you would rather an approximation, please see toApprox64.
 *
 *  val     An array of two 32-bit integers
 */
function toAbs64(val)
{
    if (val === undefined)
        throw (new Error('missing required arg: value'));

    if (!(val instanceof Array))
        throw (new Error('value must be an array'));

    if (val.length != 2)
        throw (new Error('value must be an array of length 2'));

    /* We have 20 bits worth of precision in this range */
    if (val[0] >= 0x100000)
        throw (new Error('value would become approximated'));

    return (val[0] * Math.pow(2, 32) + val[1]);
}

/*
 * Will return the 64 bit value as returned in an array from rsint64 / ruint64
 * to a value as close as it can. Note that Javascript stores all numbers as a
 * double and the mantissa only has 52 bits. Thus this version may approximate
 * the value.
 *
 *  val     An array of two 32-bit integers
 */
function toApprox64(val)
{
    if (val === undefined)
        throw (new Error('missing required arg: value'));

    if (!(val instanceof Array))
        throw (new Error('value must be an array'));

    if (val.length != 2)
        throw (new Error('value must be an array of length 2'));

    return (Math.pow(2, 32) * val[0] + val[1]);
}

function to64(val){
    // Until I get around to writing a native extension, this will have to do
    try{
        return toAbs64(val);
    } catch(e){
        return toApprox64(val);
    }
}

/**
    Strings are by far the easiest thing to parse. Just the LENGTH - 4 bytes of characters, and that includes the null terminator.
**/
function decode_network_string(msgtype, len, buf){
    // This syntax is a bit strange, but it boils down to "Read a string of <len> length and return it in a field named 'content'"
    nstring = ctypeParser.readData([{content:{type:"char[" + len + "]"}}], buf, 4);
    return nstring.content.toString("ascii", 0, len-1);
}

/**
    Numbers (which describe a few different part types) are just 64 bit big endian encoded.
**/
function decode_network_number(msgtype, len, buf){
    nnumber = ctype.rsint64(buf, "big", 4);
    return to64(nnumber);
}

/**
    Values are defined by a subtype, which is described in types.db
**/
function decode_network_values(msgtype, len, buf){
    value_count = ctype.ruint16(buf, "big", 4);
    var values = new Array();
    var value_types = new Array();
    var offset = 6;
    var data_offset = offset + value_count;
    for(i = 0; i < value_count; i++){
        value_types.push(ctype.ruint8(buf, "big", offset + i));
    }
    value_types.forEach(function(type, index){
        value = null;
        switch(type){
            case DS_TYPE_COUNTER:
            case DS_TYPE_ABSOLUTE:
                value = to64(ctype.ruint64(buf, "big", data_offset+(8*index)));
                break;
            case DS_TYPE_GAUGE:
                value = ctype.rdouble(buf, "little", data_offset+(8*index));
                break;
            case DS_TYPE_DERIVE:
                value = to64(ctype.rsint64(buf, "big", data_offset+(8*index)));
                break;
            default:
                throw new Error("Sorry, can't handle variable type " + type);
                break;
        }
        values.push([type, value]);
    });
    return values;
}

// Ugly and very much cribbed from the Python version
var decoders = new Array();
decoders[TYPE_HOST] = decode_network_string;
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

// Convert from the flat type->value array to something more object-based
function interpret_results(results){
    var val_objects = new Array();
    var notifications = new Array();
    var v = n = new Object();
    
    results.forEach(function(obj){
        switch(obj[0]){
            case TYPE_TIME:
                n.time = v.time = obj[1];
                break;
            case TYPE_TIME_HIRES:
                n.time_hires = v.time_hires = obj[1];
                break;
            case TYPE_INTERVAL:
                n.interval = v.interval = obj[1];
                break;
            case TYPE_INTERVAL_HIRES:
                n.interval_hires = v.interval_hires = obj[1];
                break;
            case TYPE_HOST:
                n.host = v.host = obj[1];
                break;
            case TYPE_PLUGIN:
                n.plugin = v.plugin = obj[1];
                break;
            case TYPE_PLUGIN_INSTANCE:
                n.plugin_instance = v.plugin_instance = obj[1];
                break;
            case TYPE_TYPE:
                n.type = v.type = obj[1];
                break;
            case TYPE_TYPE_INSTANCE:
                n.type_instance = v.type_instance = obj[1];
                break;
            case TYPE_SEVERITY:
                n.severity = obj[1];
                break;
            case TYPE_MESSAGE:
                n.message = obj[1];
                notifications.push(n);
                break;
            case TYPE_VALUES:
                v.data = obj[1];
                val_objects.push(v);
                break;
        };
    });
    return [val_objects, notifications];
}

exports.collectd_parse = function decode_network_packet(buf){
    var results = new Array();
    var current_object = null;
    var offset = 0, blength = buf.length;
    while(offset < blength){
        
        header = ctypeParser.readData(headerPacket, buf, offset);
        
        decoder = decoders[header.type];
        if(undefined !== decoder){
            value = decoder(header.type, header.length - 4, buf.slice(offset, offset+header.length));
            results.push([header.type, value]);
        } else {
            console.error("No handler for type " + header.type);
        }
        offset+= header.length;
    }
    return interpret_results(results);
}