/*******************************************************************************
 * Copyright (c) 2013 Matteo Collina
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

describe("Ponte as an MQTT server", function() {

  var settings;
  var instance;

  beforeEach(function(done) {
    settings = ponteSettings();
    instance = ponte(settings, done);
  });

  afterEach(function(done) {
    instance.close(done);
  });

  it("should allow a client to publish and subscribe", function(done) {
    var client = mqtt.createClient(settings.mqtt.port);
    client
      .subscribe("/hello")
      .publish("/hello", "world")
      .on("message", function(topic, payload) {
        expect(topic).to.eql("/hello");
        expect(payload).to.eql("world");
        done();
      });
  });

  it("should expose retained messages to HTTP", function(done) {
    var client = mqtt.createClient(settings.mqtt.port);
    client
      .publish("hello", "world", { retain: true, qos: 1 }, function() {
        request(instance.http.server)
          .get("/resources/hello")
          .expect(200, "world", done);
      });
  });

  it("should expose retained messages to HTTP (double slash)", function(done) {
    var client = mqtt.createClient(settings.mqtt.port);
    client
      .publish("/hello", "world", { retain: true, qos: 1 }, function() {
        request(instance.http.server)
          .get("/resources//hello")
          .expect(200, "world", done);
      });
  });

  it("should emit an 'updated' event after a publish", function(done) {

    var client = mqtt.createClient(settings.mqtt.port);
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
});
