
var mosca = require("mosca");
var HTTP = require("./http");
var CoAP = require("./coap");
var persistence = require("./persistence");
var ascoltatori = require("ascoltatori");
var bunyan = require("bunyan");
var xtend = require("xtend");

module.exports = [{
  service: "logger",
  factory: function(opts, done) {
    delete opts.ponte;
    done(null, bunyan.createLogger(opts));
  },
  defaults: {
    name: "ponte",
    level: 40
  }
}, {
  service: 'broker',
  factory: function(opts, done) {
    opts.json = false;
    ascoltatori.build(opts, function(ascoltatore) {
      done(null, ascoltatore);
    });
  }
}, {
  service: "persistence",
  factory: persistence,
  defaults: {
    type: "memory"
  }
}, {
  service: "mqtt",
  factory: function(opts, cb) {
    opts.ascoltatore = opts.ponte.broker;
    opts.logger = xtend(opts.logger || {}, {
      childOf: opts.ponte.logger,
      level: opts.ponte.logger.level(),
      service: "MQTT"
    });
    var server = new mosca.Server(opts, cb);
    server.on('published', function moscaPonteEvent(packet) {
      opts.ponte.emit('updated', packet.topic, packet.payload);
    });
    opts.ponte.persistence.wire(server);
  }
}, {
  service: "http",
  factory: HTTP,
  defaults: {
    port: 3000
  }
}, {
  service: "coap",
  factory: CoAP,
  defaults: {
    port: 5683
  }
}];
