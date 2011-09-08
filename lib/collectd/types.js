var	fs	= require("fs");

var line_regex 	= /^(\S+)\s+(.*)$/;
var val_regex 	= /(\w+):(\w+):-?(\d+|U):(\d+|U)$/i;

function parse_typedb(content){
	if('string' === typeof content){
		content = content.split("\n");
	}

	types = new Array();
	content.forEach(function(line, index){
		line = line.trim();
		if(line[0] == "#" || line.length == 0)
			return;

		var match = line_regex.exec(line);
		if(match != null){
			types[match[1]] = parse_value_description(match[2]);	
		} else {
			console.error("Line does not match: ", line);
		}
	});
	return types;
}

function parse_value_description(descs){
	if(descs.search(",") == -1 ){
		descs = [descs];		
	} else {
		descs = descs.split(",");
	}

	dobjs = new Array();
	descs.forEach(function(descr, index){
		match = val_regex.exec(descr);
		if(match != null){
			dobjs.push({
				name:match[1],
				type:match[2],
				min:match[3],
				max:match[4]
			});
		} else {
			console.error("Value does not match: ", descr);
		}
	});
	return dobjs;
}

function wrap_results(results, types){
	results.forEach(function(result_type, index){
		result_type.forEach(function(result){
			console.log(result);
			if(result.type in types){
				var newdata = new Array();
				type = types[result.type];
				result.data.forEach(function(datum, i){
					if(type[i] != null){
						datum["name"] = type[i].name;
						datum["type"] = type[i].type;
						datum["min"] = type[i].min;
						datum["max"] = type[i].max;
						datum["value"] = datum[1];
					}
				});
			} else {
				console.log(result.type, " is not a known type.");
			}
		});
	});
	return results;
}

exports.parse_typedb = parse_typedb;
exports.wrap_results = wrap_results;