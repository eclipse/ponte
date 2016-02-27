Ponte
=====

![Ponte Logo](https://raw.githubusercontent.com/eclipse/ponte/master/artwork/logo-banner-white.png)

__Ponte__ is a multi-transport Internet of Things / Machine to Machine broker.
As the current state it supports [MQTT](http://mqtt.org/) and REST
APIs over HTTP and CoAP.

![Ponte Architecture](https://raw.githubusercontent.com/eclipse/ponte/master/architecture.png)

__Ponte__ is under active development, but it should work :).
If you plan to use Ponte in production
[let us know](http://twitter.com/matteocollina), we'll be more than
happy to help you getting started and solve any issue you'll find out.

A test instance of ponte is available at [ponte.eclipse.org](ponte.eclipse.org), on HTTP,
MQTT and CoAP standard ports.

Report bugs at the [Eclipse
Bugzilla](https://bugs.eclipse.org/bugs/buglist.cgi?component=Core&product=Ponte&resolution=---)
and join the [mailing list](https://dev.eclipse.org/mailman/listinfo/ponte-dev).

## Installation

Ponte is a node.js application, so it needs [node.js](http://nodejs.org)
to run. The currently recommended version is node 4.3.1, which is the Longtime Support Version. Ponte is tested against versions 0.12, 4.3.1 and 5. *Attention: you should currently not use ponte with node 5.7*

```
$ npm install ponte bunyan -g
$ ponte -v | bunyan
```

Then you can connect to it with your preferred [MQTT](http://mqtt.org),
[CoAP](https://datatracker.ietf.org/doc/draft-ietf-core-coap/) or
[HTTP](http://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol) client.

### Command Line Options

```
$ ./bin/ponte --help

  Usage: ponte [options]

  Options:

    -h, --help           output usage information
    -V, --version        output the version number
    -m, --mqtt-port <n>  the mqtt port to listen to
    -p, --http-port <n>  the http port to listen to
    -a, --coap-port <n>  the coap port to listen to
    --host <host>        the host to listen to
    --coap-host <host>   the host to listen to for coap requests
    --mqtt-host <host>   the host to listen to for mqtt requests
    --http-host <host>   the host to listen to for http requests
    -d, --db <path>      the path were to store the database
    -c, --config <c>     the config file to use (override every other option)
    -v, --verbose        set the bunyan log to INFO
    --very-verbose       set the bunyan log to DEBUG
```

## Usage Example

Start ponte:
```bash
$ ponte -v | bunyan
```

### Publishing from HTTP to MQTT

Publish from HTTP:

```
$ curl -X PUT -d 'world' http://localhost:3000/resources/hello
```

The messages from HTTP are _retained_, which means that are sent to
every new subscriber.

Subscribe using `mosquitto_sub` ([mosquitto](http://mosquitto.org)):

```
$ mosquitto_sub -t "hello" -v
hello world
```

### Publishing from MQTT to HTTP

In order to publish a message that can be read from HTTP,
a MQTT client needs to set the _retain_ flag.
This is how it is done using `mosquitto_pub`:

```
$ mosquitto_pub -t hello-from-mqtt -m "world" -r
```

Reading the published value is an HTTP GET away:

```
$ curl http://localhost:3000/resources/hello-from-mqtt
world
```

### Publishing from CoAP to MQTT

You can send CoAP messages from the command line using [coap-cli](http://github.com/mcollina/coap-cli)
In the following example we do a CoAP PUT to a resource:

```
$ echo -n 'world' | coap put coap://localhost/r/hello
```

Subscribe using `mosquitto_sub` ([mosquitto](http://mosquitto.org)):

```
$ mosquitto_sub -t "hello" -v
hello world
```

### Publishing MQTT to CoAP

In order to publish a message that can be read from CoAP,
a MQTT client needs to set the _retain_ flag.
This is how it is done using `mosquitto_pub`:

```
$ mosquitto_pub -t hello-from-mqtt -m "world" -r
```

In order to receive the live updates with CoAP, we need to
use the observe switch:

```
$ coap -o coap://localhost/r/hello-from-mqtt
```

## Embedding

__Ponte__ can be run in embbedded mode, by listening to specific events:

```javascript
var ponte = require("ponte");
var opts = {
  logger: {
    level: 'info'
  },
  http: {
    port: 3000 // tcp
  },
  mqtt: {
    port: 3001 // tcp
  },
  coap: {
    port: 3000 // udp
  },
  persistence: {
    type: 'level',
    path: './db'
  }
};
var server = ponte(opts);

server.on("updated", function(resource, buffer) {
  console.log("Resource Updated", resource, buffer);
});

// Stop the server after 1 minute
setTimeout(function() {
  server.close(function() {
    console.log("server stopped");
  });
}, 60 * 1000);
```

## Configuration


### Configuration with MongoDB

__Ponte__ can be run on top of MongoDB with the following configuration:

```js
module.exports = {
  persistence: {
    // same as http://mcollina.github.io/mosca/docs/lib/persistence/mongo.js.html
    type: "mongo",
    url: "mongodb://localhost:27017/ponte"
  },
  broker: {
    // same as https://github.com/mcollina/ascoltatori#mongodb
    type: "mongo",
    url: "mongodb://localhost:27017/ponte"
  },
  logger: {
    level: 30, // or 20 or 40
    name: "MongoPonte"
  }
};
```

Launch it with `$ ponte -c config.js`.

### Configuration with Redis

__Ponte__ can be run on top of Redis with the following configuration:

```js
module.exports = {
  persistence: {
    // same as http://mcollina.github.io/mosca/docs/lib/persistence/redis.js.html
    type: "redis",
    host: "localhost"
  },
  broker: {
    // same as https://github.com/mcollina/ascoltatori#redis
    type: "redis",
    host: "localhost"
  },
  logger: {
    level: 20,
    name: "Config Test Logger"
  }
};
```

Launch it with `$ ponte -c config.js`.

### Configuration with MQTT and Redis

__Ponte__ can be run on top of MQTT broker while using Redis (or similarly MongoDB) with the following configuration:

```js
module.exports = {
  persistence: {
    // same as http://mcollina.github.io/mosca/docs/lib/persistence/redis.js.html
    type: "redis",
    host: "localhost"
  },
  broker: {
    // same as https://github.com/mcollina/ascoltatori#mqtt
    type: "mqtt",
    port: "2883",
    host: "localhost"
  },
  logger: {
    level: 20,
    name: "Config Test Logger"
  }
};
```

### Configuration with authentication and authorization callbacks

```js
module.exports = {
  coap: {
    /**
     * @param {Object} req The incoming message @link https://github.com/mcollina/node-coap#incoming
     * @param {Function} callback The callback function. Has the following structure: callback(error, authenticated, subject)
     */
    authenticate: function(req, callback) {
      // Examples:
      //   Error:             callback(error);
      //   Authenticated:     callback(null, true, { username: 'someone' });
      //   Not authenticated: callback(null, false);
    },
    /**
     * @param {Object} subject The subject returned by the authenticate function
     * @param {string} topic The topic
     * @param {Function} callback The callback function. Has the following structure: callback(error, authorized)
     */
    authorizeGet: function(subject, topic, callback) {
      // Examples:
      //   Error:          callback(error);
      //   Authorized:     callback(null, true);
      //   Not authorized: callback(null, false);
    },
    /**
     * @param {Object} subject The subject returned by the authenticate function
     * @param {string} topic The topic
     * @param {Buffer} payload The payload
     * @param {Function} callback The callback function. Has the following structure: callback(error, authorized)
     */
    authorizePut: function(subject, topic, payload, callback) {
      // Examples:
      //   Error:          callback(error);
      //   Authorized:     callback(null, true);
      //   Not authorized: callback(null, false);
    }
  },
  http: {
    /**
     * @param {Object} req The request object
     * @param {Function} callback The callback function. Has the following structure: callback(error, authenticated, subject)
     */
    authenticate: function(req, callback) {
      // See coap.authenticate
    },
    /**
     * @param {Object} subject The subject returned by the authenticate function
     * @param {string} topic The topic
     * @param {Function} callback The callback function. Has the following structure: callback(error, authorized)
     */
    authorizeGet: function(subject, topic, callback) {
      // See coap.authorizeGet
    },
    /**
     * @param {Object} subject The subject returned by the authenticate function
     * @param {string} topic The topic
     * @param {string} payload The payload
     * @param {Function} callback The callback function. Has the following structure: callback(error, authorized)
     */
    authorizePut: function(subject, topic, payload, callback) {
      // See coap.authorizePut
    }
  },
  mqtt: {
    /**
     * @link https://github.com/mcollina/mosca/wiki/Authentication-&-Authorization
     */
    authenticate: function(client, username, password, callback) {
      // ...
    },
    authorizePublish: function(client, topic, payload, callback) {
      // ...
    },
    authorizeSubscribe: function(client, topic, callback) {
      // ...
    }
  }
}
```

Launch it with `$ ponte -c config.js`.

## Pub/Sub Brokers

__Ponte__ is based on
[Ascoltatori](http://github.com/mcollina/ascoltatori), so it supports the same backends:

* [RabbitMQ](http://www.rabbitmq.com/) and all implementations of
  the [AMQP](http://www.amqp.org/) protocol.
* [Redis](http://redis.io/), the fabulous key/value store by
  [@antirez](https://github.com/antirez).
* [Mosquitto](http://mosquitto.org/) and all implementations of the
  [MQTT](http://mqtt.org/) protocol.
* [MongoDB](http://www.mongodb.org/), the documental NoSQL that
  is revolutionizing how web apps are built.
* [ZeroMQ](http://www.zeromq.org/) without a central broker, so
  Ascoltatori can also be used in a P2P fashion.

## Persistence

__Ponte__ requires a persistent storage for HTTP syndication and MQTT
support.
At the current state, it uses [Mosca](http://github.com/mcollina/mosca)
persistence layer.
Thus, it offers several persitence options:

* [Memory](http://mcollina.github.com/mosca/docs/lib/persistence/memory.js.html),
* [LevelUp](http://mcollina.github.com/mosca/docs/lib/persistence/levelup.js.html),
* [Redis](http://mcollina.github.com/mosca/docs/lib/persistence/redis.js.html),
* [MongoDB](http://mcollina.github.com/mosca/docs/lib/persistence/mongo.js.html)

All of them can be configured from the configuration file, under the
`persistence` key. The only exception is LevelUp, which can be specified
by using the `--db` option from the command line.

## To do

These are the new features you should expect in the coming
months:

* [ ] Add Web Hooks support.
* [ ] Document configuration options.
* [ ] Add WebSocket and Server-Sent Events support.
* [ ] Add a Web App for reading and writing.
* [ ] Standalone persistence layer.

Any help is very welcome, so feel free to submit a pull-request.

## Eclipse, QEST and Ponte

Ponte is a proposal at Eclipse, and this is a pure-JS rewrite of
[QEST](http://github.com/mcollina/qest) in Javascript and on top of
[Mosca](http://github.com/mcollina/mosca).
You can find the Eclipse Project Proposal here:
http://eclipse.org/proposals/technology.ponte/

## Contributing to Ponte

* Check out the latest master to make sure the feature hasn't been
  implemented or the bug hasn't been fixed yet
* Check out the issue tracker to make sure someone already hasn't
  requested it and/or contributed it
* Fork the project
* Start a feature/bugfix branch
* Commit and push until you are happy with your contribution
* Make sure to add tests for it. This is important so I don't break it
  in a future version unintentionally.
* Please try not to mess with the Makefile and package.json. If you
  want to have your own version, or is otherwise necessary, that is
  fine, but please isolate to its own commit so I can cherry-pick around
  it.

## LICENSE

__Ponte__ is dual licensed under the "Eclipse Public License - v 1.0" and the
"Eclipse Distribution License - v 1.0".
