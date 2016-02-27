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
 *    Matteo Collina - initial API and implementation and/or initial documentation
 *******************************************************************************/

var commander = require("commander");
var pkg = require("../package.json");
var path = require("path");

module.exports = function(args, done) {

  args = args || [];

  var program = new commander.Command();
  var server = null;
  var runned = false;

  program
    .version(pkg.version)
    .option("-m, --mqtt-port <n>", "the mqtt port to listen to", parseInt)
    .option("-p, --http-port <n>", "the http port to listen to", parseInt)
    .option("-a, --coap-port <n>", "the coap port to listen to", parseInt)
    .option("--host <host>", "the host to listen to")
    .option("--coap-host <host>", "the host to listen to for coap requests")
    .option("--mqtt-host <host>", "the host to listen to for mqtt requests")
    .option("--http-host <host>", "the host to listen to for http requests")
    .option("-d, --db <path>", "the path were to store the database")
    .option("-c, --config <c>", "the config file to use (override every other option)")
    .option("-v, --verbose", "set the bunyan log to INFO")
    .option("--very-verbose", "set the bunyan log to DEBUG");

  program.parse(args);

  var opts = {
    logger: {},
    http: {},
    mqtt: {},
    coap: {},
    persistence: {}
  };

  if (program.verbose) {
    opts.logger.level = 30;
  } else if (program.veryVerbose) {
    opts.logger.level = 20;
  }

  if (program.httpPort) {
    opts.http.port = program.httpPort;
  }

  if (program.mqttPort) {
    opts.mqtt.port = program.mqttPort;
  }

  if (program.coapPort) {
    opts.coap.port = program.coapPort;
  }

  if (program.host) {
    opts.coap.host = program.host;
    opts.mqtt.host = program.host;
    opts.http.host = program.host;
  }

  if (program.coapHost) {
    opts.coap.host = program.coapHost;
  }

  if (program.mqttHost) {
    opts.mqtt.host = program.mqttHost;
  }

  if (program.httpHost) {
    opts.http.host = program.httpHost;
  }

  if (program.db) {
    opts.persistence.path = program.db;
    opts.persistence.type = "level";
  }

  if (program.config) {
    opts = require(path.resolve(program.config));
  }

  return this(opts, done);
};
