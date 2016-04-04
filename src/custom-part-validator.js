'use strict';

var isObjectLike = require('lodash/isObjectLike');
var isNil = require('lodash/isNil');
var isNumber = require('lodash/isNumber');
var isString = require('lodash/isString');

function isTypeCodeWithinValidRange(typeCode) {
    return typeCode > 0x0009 && typeCode < 0x0100;
}

function isPartTypeCodeValid(partTypeCode) {
    return isNumber(parseInt(partTypeCode)) && !isNaN(partTypeCode) && isTypeCodeWithinValidRange(partTypeCode);
}

function isPartNameValid(partName) {
    return isString(partName) && partName.length > 0;
}

function isCustomPartConfigValid(partTypeCode, partName) {
    return isPartTypeCodeValid(partTypeCode) && isPartNameValid(partName);
}

exports.validateCustomPartsConfig = function(customStringParts) {
    var partIsValid = false;

    if (!isNil(customStringParts) && isObjectLike(customStringParts)) {
        partIsValid = true;
        for (var partTypeCode in customStringParts) {
            if (customStringParts.hasOwnProperty(partTypeCode) &&
                !isCustomPartConfigValid(partTypeCode, customStringParts[partTypeCode])) {
                partIsValid = false;
                break;
            }
        }
    }

    return partIsValid;
};