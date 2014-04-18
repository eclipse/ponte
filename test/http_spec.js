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
var ponte = require("../lib/ponte");
var mqtt = require("mqtt");

describe("Ponte as an HTTP API", function() {

  var settings;
  var instance;

  beforeEach(function(done) {
    settings = ponteSettings();
    instance = ponte(settings, done);
  });

  afterEach(function(done) {
    instance.close(done);
  });

  it("should GET an unknown topic and return a 404", function(done) {
    request(instance.http.server)
      .get("/resources/hello")
      .expect(404, done);
  });

  it("should PUT a topic and return a 204", function(done) {
    request(instance.http.server)
      .put("/resources/hello")
      .send("hello world")
      .expect(204, done);
  });

  it("should PUT a topic and return a Location header", function(done) {
    request(instance.http.server)
      .put("/resources/hello")
      .send("hello world")
      .expect('Location', '/resources/hello', done);
  });

  it("should PUT and GET a topic and its payload", function(done) {
    request(instance.http.server)
      .put("/resources/hello")
      .set("content-type", "text/plain")
      .send("hello world")
      .expect(204, function() {
        request(instance.http.server)
          .get("/resources/hello")
          .expect(200, "hello world", done);
      });
  });

  it("should publish a value to MQTT after PUT", function(done) {
    mqtt.createClient(settings.mqtt.port)

      .subscribe("hello", function() {
        request(instance.http.server)
          .put("/resources/hello")
          .send("world")
          .end(function(err) {
            if (err) {
              done(err);
            }
          });
      })

      .on("message", function(topic, payload) {
        expect(topic).to.eql("hello");
        expect(payload).to.eql("world");
        done();
      });
  });

  it("should emit an 'updated' event after a put", function(done) {
    request(instance.http.server)
      .put("/resources/hello")
      .set("content-type", "text/plain")
      .send("hello world")
      .end(function() {});

    instance.on('updated', function(resource, value) {
      expect(resource).to.eql("hello");
      expect(value).to.eql(new Buffer("hello world"));
      done();
    });
  });
});
