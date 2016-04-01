'use strict';

var assert = require('chai').assert;

var subject = require('../src/converters');

describe('When converting stuff using collectd\'s binary protocol', function () {

    var MAX_INT = 9223372034707292159;
    var MIN_INT = -9223372034707292159;

    /*jshint -W117 */
    before(function () {
    });

    it('should convert positive 64 bits integer to hexadecimal array', function () {
        var result = subject.approximateInt64ToHexArray(10);
        var reverse = subject.to64(result);

        assert.sameMembers([0, 10], result);
        assert.equal(10, reverse);
    });

    it('should convert large positive 64 bits integer to hexadecimal array', function () {
        var result = subject.approximateInt64ToHexArray(2587463214852);
        var reverse = subject.to64(result);

        assert.sameMembers([602, 1892902660], result);
        assert.equal(2587463214852, reverse);
    });

    it('should convert max positive 64 bits integer to hexadecimal array', function () {
        var result = subject.approximateInt64ToHexArray(MAX_INT);
        var reverse = subject.to64(result);

        assert.sameMembers([2147483647, 2147483648], result);
        assert.equal(MAX_INT, reverse);
    });

    it('should convert negative 64 bits integer to hexadecimal array', function () {
        var result = subject.approximateInt64ToHexArray(-10);
        var reverse = subject.to64(result);

        assert.sameMembers([0, -10], result);
        assert.equal(-10, reverse);
    });

    it('should convert min negative 64 bits integer to hexadecimal array', function () {
        var result = subject.approximateInt64ToHexArray(MIN_INT);
        var reverse = subject.to64(result);

        assert.sameMembers([-2147483647, -2147483648], result);
        assert.equal(MIN_INT, reverse);
    });

    it('should convert large positive 64 bits integer to hexadecimal array', function () {
        var result = subject.approximateInt64ToHexArray(-2587463214852);
        var reverse = subject.to64(result);

        assert.sameMembers([-602, -1892902660], result);
        assert.equal(-2587463214852, reverse);
    });

    it('should convert 0 to hexadecimal array', function () {
        var result = subject.approximateInt64ToHexArray(0);
        var reverse = subject.to64(result);

        assert.sameMembers([0, 0], result);
        assert.equal(0, reverse);
    });

    it('should convert -1 to hexadecimal array', function () {
        var result = subject.approximateInt64ToHexArray(-1);
        var reverse = subject.to64(result);

        assert.sameMembers([0, -1], result);
        assert.equal(-1, reverse);
    });

    it('should convert 1 to hexadecimal array', function () {
        var result = subject.approximateInt64ToHexArray(1);
        var reverse = subject.to64(result);

        assert.sameMembers([0, 1], result);
        assert.equal(1, reverse);
    });

    it('should throw when int is greater than max', function () {
        assert.throw(function () { subject.approximateInt64ToHexArray(MAX_INT + 2000); });
    });

    it('should throw when int is lesser than min', function () {
        assert.throw(function () { subject.approximateInt64ToHexArray(MIN_INT - 2000); });
    });

    it('should convert type name to code', function () {
        var result = subject.getTypeCodeFromName('type');
        assert.equal(4, result);
    });

    it('should return undefined when type name is not found', function () {
        var result = subject.getTypeCodeFromName('invalid');
        assert.equal(undefined, result);
    });

    it('should convert type code to name', function () {
        var result = subject.getTypeNameFromCode(4);
        assert.equal('type', result);
    });

    it('should return undefined when type code is not found', function () {
        var result = subject.getTypeNameFromCode(400);
        assert.equal(undefined, result);
    });
});