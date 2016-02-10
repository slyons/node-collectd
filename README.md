collectd-protocol
=============

[![NPM version][npm-image]][npm-url] [![Build Status](https://travis-ci.org/Mindera/collectd-protocol.svg?branch=master)](https://travis-ci.org/Mindera/collectd-protocol)

  This is a NodeJS module for decoding Collectd's binary protocol [collectd](http://collectd.org/). It supports decoding binary protocol from versions 4 and 5 of collectd.

## Installation

  npm install collectd-protocol --save
  
## Contributing

  In lieu of a formal styleguide, take care to maintain the existing coding style.
  Add unit tests for any new or changed functionality. Lint and test your code.
  
## TODO
  * Get better mocked binary streams to increase code coverage

## Release History

  * 0.0.1
    - Fork from [node-collectd](https://github.com/Mindera/node-collectd)
    - Removed the CollectD receiver to make this module a protocol
    - Changed the protocol to just use `timer` and `interval` properties whether is high resolution or not
    - Updated node-ctype dependency and removed unnecessary code
    - Added unit tests
    - Integration with Grunt
    - Integration with Travis

[npm-url]: https://npmjs.org/package/collectd-protocol
[npm-image]: https://badge.fury.io/js/collectd-protocol.svg