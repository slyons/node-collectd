'use strict';

var assert = require('chai').assert;

var decoder = require('../src/decoder');
var encoder = require('../src/encoder');

describe('When decoding collectd\'s binary protocol', function () {

    var defaultMock;
    var typesMock;
    var customTypeMock;

    /*jshint -W117 */
    before(function () {
        defaultMock = [{
            host: 'localhost',
            time: 1455098772,
            interval: 10,
            plugin: 'GenericJMX',
            plugin_instance: 'MemoryPool|Eden_Space',
            type: 'memory',
            type_instance: 'committed',
            dstypes: [ 'gauge' ],
            values: [ 152567808.92 ],
            dsnames: [ 'value' ]
        }];

        typesMock = [
            {
                host: 'localhost',
                time: 1445108447,
                interval: 10,
                plugin: 'interface',
                plugin_instance: 'eth0',
                type: 'if_octets',
                type_instance: '',
                dstypes: ['derive', 'derive'],
                values: [1175716173359, 3666029034357],
                dsnames: ['rx', 'tx']
            },
            {
                "host": "localhost",
                "time": 1445108447,
                "interval": 10,
                "plugin": "load",
                "plugin_instance": "",
                "type": "load",
                "type_instance": "",
                "values": [0.02, 0.21, 0.3],
                "dstypes": ["gauge", "gauge", "gauge"],
                "dsnames": ["shortterm", "midterm", "longterm"]
            }
        ];

        customTypeMock = [{
            host: 'localhost',
            time: 1455098772,
            interval: 10,
            plugin: 'GenericJMX',
            plugin_instance: 'MemoryPool|Eden_Space',
            type: 'custom',
            type_instance: 'committed',
            dstypes: [ 'gauge' ],
            values: [ 152567808.92 ],
            dsnames: [ 'value' ]
        }];
    });

    it('should decode plugin data', function (done) {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.equal('GenericJMX', decoded[0].plugin);
            assert.equal('MemoryPool|Eden_Space', decoded[0].plugin_instance);
            done();
        });
    });

    it('should decode type data', function (done) {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.equal('memory', decoded[0].type);
            assert.equal('committed', decoded[0].type_instance);
            done();
        });
    });

    it('should decode time data', function (done) {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.equal(1455098772, decoded[0].time);
            done();
        });
    });

    it('should decode high resolution time', function (done) {
        var defaultMock = [{
            host: 'localhost',
            time_hires: 1562400409547440000,
            interval: 10,
            plugin: 'GenericJMX',
            plugin_instance: 'MemoryPool|Eden_Space',
            type: 'memory',
            type_instance: 'committed',
            dstypes: [ 'gauge' ],
            values: [ 152567808.92 ],
            dsnames: [ 'value' ]
        }];

        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.equal(1455098772, decoded[0].time);
            done();
        });
    });

    it('should decode interval data', function (done) {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.equal(10, decoded[0].interval);
            done();
        });
    });

    it('should decode high resolution interval data', function (done) {
        var defaultMock = [{
            host: 'localhost',
            time: 1455098772,
            interval_hires: 10737418240,
            plugin: 'GenericJMX',
            plugin_instance: 'MemoryPool|Eden_Space',
            type: 'memory',
            type_instance: 'committed',
            dstypes: [ 'gauge' ],
            values: [ 152567808.92 ],
            dsnames: [ 'value' ]
        }];

        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.equal(10, decoded[0].interval);
            done();
        });
    });

    it('should decode host data', function (done) {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.equal('localhost', decoded[0].host);
            done();
        });
    });

    it('should decode gauge values', function (done) {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.sameMembers([152567808.92], decoded[0].values);
            assert.sameMembers(['gauge'], decoded[0].dstypes);
            assert.sameMembers(['value'], decoded[0].dsnames);
            done();
        });
    });

    it('should decode derive metrics', function (done) {
        defaultMock[0].dstypes[0] = 'derive';
        defaultMock[0].values[0] = 9591;
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.sameMembers([9591], decoded[0].values);
            assert.sameMembers(['derive'], decoded[0].dstypes);
            assert.sameMembers(['value'], decoded[0].dsnames);
            done();
        });
    });

    it('should decode counter metrics', function (done) {
        defaultMock[0].dstypes[0] = 'counter';
        defaultMock[0].values[0] = 2000;
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.sameMembers([2000], decoded[0].values);
            assert.sameMembers(['counter'], decoded[0].dstypes);
            assert.sameMembers(['value'], decoded[0].dsnames);
            done();
        });
    });

    it('should decode counter metrics', function (done) {
        defaultMock[0].dstypes[0] = 'absolute';
        defaultMock[0].values[0] = 6098213;
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.sameMembers([6098213], decoded[0].values);
            assert.sameMembers(['absolute'], decoded[0].dstypes);
            assert.sameMembers(['value'], decoded[0].dsnames);
            done();
        });
    });

    it('should not convert invalid binary messages', function (done) {
        var result = decoder.decode('no binary');

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('error', function () {
            done();
        });
    });

    it('should not encode non arrays', function() {
        var result = encoder.encode(defaultMock[0]);
        assert.equal(null, result);
    });

    it('should not throw when input is undefined', function () {
        assert.doesNotThrow(function () {
            decoder.decode(undefined);
        });
    });

    it('should not throw when input is an invalid buffer', function (done) {
        var result = decoder.decode('|\\sw>!@,[]/%*.');

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('error', function () {
            done();
        });
    });
    
    it('should decode metrics with types from types.db specification', function(done) {
        var binaryData = encoder.encode(typesMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.deepEqual(decoded, typesMock);
            done();
        });
    });

    it('should decode metrics with custom types not in types.db specification', function(done) {
        var binaryData = encoder.encode(customTypeMock);

        var result = decoder.decode(binaryData);

        var decoded;
        result.on('data', function(data) {
            decoded = data;
        }).on('end', function () {
            assert.deepEqual(decoded, customTypeMock);
            done();
        });
    });
});