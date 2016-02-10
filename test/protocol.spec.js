'use strict';

var path = require('path');
var assert = require('chai').assert;
var fs = require('fs');
var victim = require('../src/protocol');

describe('When decoding collectd\'s binary protocol', function () {

    var binaryData;

    /*jshint -W117 */
    before(function () {
        binaryData = fs.readFileSync(path.resolve(__dirname, './collectd-mock-data.bin'));
    });

    it('should decode plugin data', function () {
        var result = victim.decode(binaryData);

        assert.equal('GenericJMX', result[0].plugin);
        assert.equal('MemoryPool|Eden_Space', result[0].plugin_instance);
    });

    it('should decode type data', function () {
        var result = victim.decode(binaryData);

        assert.equal('memory', result[0].type);
        assert.equal('committed', result[0].type_instance);
    });

    it('should decode time data', function () {
        var result = victim.decode(binaryData);

        assert.equal(1562400410.1753733, result[0].time);
    });

    it('should decode interval data', function () {
        var result = victim.decode(binaryData);

        assert.equal(10.73741824, result[0].interval);
    });

    it('should decode host data', function () {
        var result = victim.decode(binaryData);

        assert.equal('localhost', result[0].host);
    });

    it('should decode gauge values', function () {
        var result = victim.decode(binaryData);

        assert.sameMembers([152567808], result[0].values);
        assert.sameMembers(['gauge'], result[0].dstypes);
        assert.sameMembers(['value'], result[0].dsnames);
    });

    it('should decode derive metrics', function () {
        var result = victim.decode(binaryData);

        assert.sameMembers([9591], result[24].values);
        assert.sameMembers(['derive'], result[24].dstypes);
        assert.sameMembers(['value'], result[24].dsnames);
    });

    it ('should not convert invalid binary messages', function () {
        var result = victim.decode('no binary');
        assert.equal(0, result.length);
    });
});