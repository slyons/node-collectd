collectd-protocol
=============

[![NPM version][npm-image]][npm-url] [![Build Status](https://travis-ci.org/Mindera/collectd-protocol.svg?branch=master)](https://travis-ci.org/Mindera/collectd-protocol)

  This is a NodeJS module for decoding and encoding Collectd's binary protocol [collectd](http://collectd.org/). It supports decoding/encoding binary protocol from versions 4 and 5 of collectd.
  
## Custom binary protocol

  This module allows to build a binary protocol based on Collectd's specification using custom string parts. This is useful when you need to send some kind of metadata with the metrics. It's not guaranteed that the custom protocol works with the protocol defined in the specification. Use at you own risk.
  
### Configuring the custom parts

  To exchange metrics with a custom `tags` part, both ends would have to support the following configuration:
  
    var binaryData = encoder.encodeCustom(originalJsonData, { 0x0099: 'tags' });
    var jsonData = decoder.decodeCustom(binaryData, { 0x0099: 'tags' });`
    
  Would produce something like:
  
    [
      {
        host: 'localhost',
        time: 1455098772,
        interval: 10,
        plugin: 'GenericJMX',
        plugin_instance: 'MemoryPool|Eden_Space',
        type: 'custom',
        type_instance: 'committed',
        dstypes: [ 'gauge' ],
        values: [ 152567808.92 ],
        dsnames: [ 'value' ],
        tags: 'host=localhost,cluster=dev'
      }
    ]
    
  In the custom part configuration we have chosen the part type id `0x0099` because it's currently unused in the binary protocol specification. Note that future revisions of the binary protocol may use your custom part ids.

## Installation

  npm install collectd-protocol --save
  
## Contributing

  In lieu of a formal styleguide, take care to maintain the existing coding style.
  Add unit tests for any new or changed functionality. Lint and test your code.
  
## Running unit tests
  
  grunt test
  
## TODO
  * Improve handling of large numbers encoding which Javascript can't handle with precision (numbers greater than Number.MAX_SAFE_INTEGER). It's ok for now since we convert high precision numbers to low precision every time, which makes the least significant bits irrelevant.
  * Support async computations on message encoding (will break current encoding interface)

## Release History

  * 0.0.1
    - Fork from [node-collectd](https://github.com/Mindera/node-collectd)
    - Removed the CollectD receiver to make this module a protocol
    - Changed the protocol to just use `timer` and `interval` properties whether is high resolution or not
    - Updated node-ctype dependency and removed unnecessary code
    - Added unit tests
    - Integration with Grunt
    - Integration with Travis
    - Created an encoder
    
  * 0.0.2
    - Remove `node_modules` directory from npm_ignore
  
  * 0.1.0
    - Add async support for decoding messages
    - Changed the decoding function to use Streams

  * 0.1.1
    - Fix invalid header check
    
  * 0.2.0
    - Add support the data-set specifications (types.db)
    
  * 0.3.0
    - Add support for custom part encoding and decoding (not compliant with binary protocol)

[npm-url]: https://npmjs.org/package/collectd-protocol
[npm-image]: https://badge.fury.io/js/collectd-protocol.svg
