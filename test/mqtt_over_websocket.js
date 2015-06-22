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

var request = require("supertest");
var mqtt = require("mqtt");
var ponte = require("../lib/ponte");
var fs = require("fs");

describe("Ponte as an MQTT-over-WebSocket server", function() {

  var settings;
  var instance;

  beforeEach(function(done) {
    settings = ponteSettings();
    instance = ponte(settings, done);
  });

  afterEach(function(done) {
    instance.close(done);
  });

  function connect() {
    return mqtt.connect('ws://localhost:' + settings.http.port);
  }

  it("should allow a client to publish and subscribe", function(done) {
    var client = connect();
    client
      .subscribe("/hello")
      .publish("/hello", "world")
      .on("message", function(topic, payload) {
        client.end();

        expect(topic).to.eql("/hello");
        expect(payload.toString()).to.eql("world");
        done();
      });
  });

  it("should expose retained messages to HTTP", function(done) {
    var client = connect();
    client
      .publish("hello", "world", { retain: true, qos: 1 }, function() {
        client.end();

        request(instance.http.server)
          .get("/resources/hello")
          .expect(200, "world", done);
      });
  });

  it("should expose retained messages to HTTP (double slash)", function(done) {
    var client = connect();
    client
      .publish("/hello", "world", { retain: true, qos: 1 }, function() {
        client.end();

        request(instance.http.server)
          .get("/resources//hello")
          .expect(200, "world", done);
      });
  });

  it("should emit an 'updated' event after a publish", function(done) {

    var client = connect();
    client.publish("/hello", "world",
                   { retain: true, qos: 1 },
                   function() {
      client.end();
    });

    instance.on('updated', function(resource, value) {
      expect(resource).to.eql("/hello");
      expect(value).to.eql(new Buffer("world"));
      done();
    });
  });

  describe("with the serve libraries option", function() {
    it("should serve the mqttws31.js file", function(done) {
      var file = fs.readFileSync(__dirname + "/../public/mqttws31.js");
      request(instance.http.server)
        .get("/mqttws31.js")
        .expect(200, file.toString(), done);
    });

    it("should serve the mqtt.js file", function(done) {
      var file = fs.readFileSync(__dirname + "/../node_modules/mosca/public/mqtt.js");
      request(instance.http.server)
        .get("/mqtt.js")
        .expect(200, file.toString(), done);
    });
  });

  describe("without the serve libraries option", function() {
    beforeEach(function() {
      settings.http.serveLibraries = false;
    });

    it("should serve the mqttws31.js file", function(done) {
      request(instance.http.server)
        .get("/mqttws31.js")
        .expect(404, done);
    });

    it("should serve the mqtt.js file", function(done) {
      request(instance.http.server)
        .get("/mqtt.js")
        .expect(404, done);
    });
  });
});
