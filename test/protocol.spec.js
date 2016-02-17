'use strict';

var assert = require('chai').assert;

var decoder = require('../src/decoder');
var encoder = require('../src/encoder');

describe('When decoding collectd\'s binary protocol', function () {

    var defaultMock;

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
    });

    it('should decode plugin data', function () {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        assert.equal('GenericJMX', result[0].plugin);
        assert.equal('MemoryPool|Eden_Space', result[0].plugin_instance);
    });

    it('should decode type data', function () {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        assert.equal('memory', result[0].type);
        assert.equal('committed', result[0].type_instance);
    });

    it('should decode time data', function () {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        assert.equal(1455098772, result[0].time);
    });

    it('should decode high resolution time', function () {
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

        assert.equal(1455098772, result[0].time);
    });

    it('should decode interval data', function () {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        assert.equal(10, result[0].interval);
    });

    it('should decode high resolution interval data', function () {
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

        assert.equal(10, result[0].interval);
    });

    it('should decode host data', function () {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        assert.equal('localhost', result[0].host);
    });

    it('should decode gauge values', function () {
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        assert.sameMembers([152567808.92], result[0].values);
        assert.sameMembers(['gauge'], result[0].dstypes);
        assert.sameMembers(['value'], result[0].dsnames);
    });

    it('should decode derive metrics', function () {
        defaultMock[0].dstypes[0] = 'derive';
        defaultMock[0].values[0] = 9591;
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        assert.sameMembers([9591], result[0].values);
        assert.sameMembers(['derive'], result[0].dstypes);
        assert.sameMembers(['value'], result[0].dsnames);
    });

    it('should decode counter metrics', function () {
        defaultMock[0].dstypes[0] = 'counter';
        defaultMock[0].values[0] = 2000;
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        assert.sameMembers([2000], result[0].values);
        assert.sameMembers(['counter'], result[0].dstypes);
        assert.sameMembers(['value'], result[0].dsnames);
    });

    it('should decode counter metrics', function () {
        defaultMock[0].dstypes[0] = 'absolute';
        defaultMock[0].values[0] = 6098213;
        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);

        assert.sameMembers([6098213], result[0].values);
        assert.sameMembers(['absolute'], result[0].dstypes);
        assert.sameMembers(['value'], result[0].dsnames);
    });

    it ('should not convert invalid binary messages', function () {
        var result = decoder.decode('no binary');
        assert.equal(0, result.length);
    });

    it('should not encode non arrays', function() {
        var result = encoder.encode(defaultMock[0]);
        assert.equal(null, result);
    });

    it('should not throw when decoder', function () {
        var defaultMock = [{
            invalid: 'localhost'
        }];

        var binaryData = encoder.encode(defaultMock);

        var result = decoder.decode(binaryData);
        assert.equal(null, result);
    });
});