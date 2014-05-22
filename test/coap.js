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

var ponte = require("../lib/ponte");
var mqtt = require("mqtt");
var coap = require("coap");
var callback = require("callback-stream");

describe("Ponte as a CoAP API", function() {

  var settings;
  var instance;

  beforeEach(function(done) {
    settings = ponteSettings();
    instance = ponte(settings, done);
  });

  afterEach(function(done) {
    instance.close(done);
  });

  it("should GET an unknown topic and return a 4.04", function(done) {
    var req = coap.request({
      port: settings.coap.port,
      pathname: "/r/hello"
    }).end();

    req.on('response', function(res) {
      expect(res.code).to.eql('4.04');
      done();
    });
  });

  it("should GET an unknown path and return a 4.04", function(done) {
    var req = coap.request({
      port: settings.coap.port,
      pathname: "/hello"
    }).end();

    req.on('response', function(res) {
      expect(res.code).to.eql('4.04');
      done();
    });
  });

  it("should PUT a topic and return a 2.04 (changed)", function(done) {
    var req = coap.request({
      port: settings.coap.port,
      pathname: "/r/hello",
      method: 'PUT'
    }).end('hello world');

    req.on('response', function(res) {
      expect(res.code).to.eql('2.04');
      done();
    });
  });

  it("should PUT a topic and set a 'Location-Path' option", function(done) {
    var req = coap.request({
      port: settings.coap.port,
      pathname: "/r/hello",
      method: 'PUT'
    }).end('hello world');

    req.on('response', function(res) {
      expect(res.headers).to.have.property('Location-Path', '/r/hello');
      done();
    });
  });

  it("should PUT a topic and return a 2.04 (changed) if the topic existed", function(done) {
    var req = coap.request({
      port: settings.coap.port,
      pathname: "/r/hello",
      method: 'PUT'
    }).end('hello world');

    req.on('response', function(res) {
      req = coap.request({
        port: settings.coap.port,
        pathname: "/r/hello",
        method: 'PUT'
      }).end('hello matteo');

      req.on('response', function(res) {
        expect(res.code).to.eql('2.04');
        done();
      });
    });
  });

  it("should PUT and GET a topic and its payload", function(done) {
    var req = coap.request({
      port: settings.coap.port,
      pathname: "/r/hello",
      method: 'PUT'
    }).end('hello world');

    req.on('response', function(res) {
      req = coap.request({
        port: settings.coap.port,
        pathname: "/r/hello",
      }).end();

      req.on('response', function(res) {
        expect(res.code).to.eql('2.05');

        res.pipe(callback(function(err, data) {
          expect(data.toString()).to.eql('hello world');
          done();
        }));
      });
    });
  });

  it("should publish a value to MQTT after PUT", function(done) {
    mqtt.createClient(settings.mqtt.port)
        .subscribe("hello", function() {
          var req = coap.request({
            port: settings.coap.port,
            pathname: "/r/hello",
            method: 'PUT'
          }).end('world');
        })

        .on("message", function(topic, payload) {
          expect(topic).to.eql("hello");
          expect(payload).to.eql("world");
          done();
        });
  });

  it("should allow to observe resources", function(done) {
    var req = coap.request({
      port: settings.coap.port,
      pathname: "/r/hello",
      method: 'PUT'
    }).end('abcdef');

    req.on('response', function(res) {

      var req2 = coap.request({
        port: settings.coap.port,
        pathname: "/r/hello",
        method: 'GET',
        observe: true
      });

      req2.on('error', function(err) {
        console.log(err);
        console.log(err.stack);
      });
      req2.end();

      req2.on('response', function(res) {
        mqtt.createClient(settings.mqtt.port)
            .publish("hello", "world", { retain: true })
            .publish("hello", "matteo", { retain: true })
            .end();

        res.once('data', function(data) {
          expect(data.toString()).to.eql('abcdef');
          res.once('data', function(data) {
            expect(data.toString()).to.eql('world');
            res.once('data', function(data) {
              done();
            });
          });
        });
      });
    });
  });

  it("should emit an 'updated' event after a put", function(done) {
    var req = coap.request({
      port: settings.coap.port,
      pathname: "/r/hello",
      method: "PUT"
    }).end("hello world");

    instance.on('updated', function(resource, value) {
      expect(resource).to.eql("hello");
      expect(value).to.eql(new Buffer("hello world"));
      done();
    });
  });
});
