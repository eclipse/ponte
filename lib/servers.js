'use strict';
/*******************************************************************************
 * Copyright (c) 2013-2014 Matteo Collina
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * and Eclipse Distribution License v1.0 which accompany this distribution.
 *
 * The Eclipse Public License is available at 
 *    http://www.eclipse.org/legal/epl-v10.html
 * and the Eclipse Distribution License is available at 
 *   http://www.eclipse.org/org/documents/edl-v10.php.
 *
 * Contributors:
 *    Matteo Collina - Extracted from ponte.js file.
 *******************************************************************************/

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
  defaults: {
    wildcardOne: '+',
    wildcardSome: '#',
    separator: '/'
  },
  factory: function(opts, done) {
    opts.json = false;
    ascoltatori.build(opts, function(err, ascoltatore) {
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
    var server = new mosca.Server(opts, function(err, instance) {
      if (typeof opts.authenticate === "function") {
        server.authenticate = opts.authenticate;
      }
      if (typeof opts.authorizePublish === "function") {
        server.authorizePublish = opts.authorizePublish;
      }
      if (typeof opts.authorizeSubscribe === "function") {
        server.authorizeSubscribe = opts.authorizeSubscribe;
      }
      cb(err, instance);
    });
    server.on('published', function moscaPonteEvent(packet) {
      if (packet.retain) {
        opts.ponte.emit('updated', packet.topic, packet.payload);
      }
    });
    opts.ponte.persistence.wire(server);
  }
}, {
  service: "http",
  factory: HTTP,
  defaults: {
    port: 3000,
    serveLibraries: true,
    publicDirs: {
      ponte: __dirname + "/../public",
      mosca: __dirname + "/../node_modules/mosca/public"
    }
  }
}, {
  service: "coap",
  factory: CoAP,
  defaults: {
    port: 5683
  }
}];
