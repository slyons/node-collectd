var protocol 	= require("./collectd/protocol"),
	types		= require("./collectd/types"),
	path		= require("path"),
	fs			= require("fs"),
	events 		= require("events"),
	dgram		= require("dgram"),
	util		= require("util");

DEFAULT_PORT = 25826
DEFAULT_IPv4_GROUP = "239.192.74.66"
DEFAULT_IPv6_GROUP = "ff18::efc0:4a42"

var CollectDReceiver = exports.Receiver = function(options){
	var self = this;

	self.options = options

	if(options.typesdb != null && path.existsSync(options.typesdb)){
		fs.readFile(options.typesdb, "ascii", function(err, data){
			if(err) throw err;
			self.typesdb = types.parse_typedb(data);
		});
	}

	self.server = null;
	if(options.server){
		self.server = options.server;
	} else {
		stype = options.protocol || "udp4";
		self.server = dgram.createSocket(stype);

		if(options.path){
			self.server.bind(options.path);
		} else {
			port = options.port || DEFAULT_PORT;
			address = options.address || DEFAULT_IPv4_GROUP;
			self.server.bind(port, address);
		}
	}
	self.server.on("message", function(msg, rinfo){
		try{
			results = protocol.collectd_parse(new Buffer(msg));
			if(self.typesdb){
				results = types.wrap_results(results, self.typesdb);
			}
			self.emit("values", results[0]);
			self.emit("notifications", results[1]);
		} catch(err){
			self.emit("error", err);
		}
	});

}

util.inherits(CollectDReceiver, events.EventEmitter);

exports.parse_typedb = types.parse_typedb;