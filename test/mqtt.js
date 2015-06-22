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

describe("Ponte as an MQTT server", function() {

  var settings;
  var instance;

  describe("without auth problems", function() {

    beforeEach(function(done) {
      settings = ponteSettings();
      instance = ponte(settings, done);
    });

    afterEach(function(done) {
      instance.close(done);
    });

    function connect() {
      return mqtt.connect('mqtt://localhost:' + settings.mqtt.port);
    }

    it("should allow a client to publish and subscribe", function(done) {
      var client = connect();
      client
        .subscribe("/hello")
        .publish("/hello", "world")
        .on("message", function(topic, payload) {
          expect(topic).to.eql("/hello");
          expect(payload.toString()).to.eql("world");
          done();
        });
    });

    it("should support wildcards", function(done) {
      var client = connect();
      client
        .subscribe("#")
        .publish("hello", "world")
        .on("message", function(topic, payload) {
          expect(topic).to.eql("hello");
          expect(payload.toString()).to.eql("world");
          done();
        });
    });

    it("should expose retained messages to HTTP", function(done) {
      var client = connect();
      client
        .publish("hello", "world", { retain: true, qos: 1 }, function() {
          request(instance.http.server)
            .get("/resources/hello")
            .expect(200, "world", done);
        });
    });

    it("should expose retained messages to HTTP (double slash)", function(done) {
      var client = connect();
      client
        .publish("/hello", "world", { retain: true, qos: 1 }, function() {
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

  });

  describe("with auth problems", function() {

    beforeEach(function(done) {
      settings = ponteSettings();

      settings.mqtt.authenticate = function(client, username, password, callback) {
        if(username == "authenticationError") {
          callback(new Error("Authentication error"));
        } else if(username == "notAuthorized") {
          callback(null, false);
        } else {
          client.user = "user";
          callback(null, true);
        }
      };
      settings.mqtt.authorizePublish = function(client, topic, payload, callback) {
        if(topic == "unauthorizedPublish") {
          callback(null, false);
        } else {
          callback(null, true);
        }
      };
      settings.mqtt.authorizeSubscribe = function(client, topic, callback) {
        if(topic == "unauthorizedSubscribe") {
          callback(null, false);
        } else {
          callback(null, true);
        }
      };

      instance = ponte(settings, done);
    });

    afterEach(function(done) {
      instance.close(done);
    });

    it("should throw a connection error if there is an authentication error", function(done){
      var client = mqtt.connect('mqtt://localhost:' + settings.mqtt.port, {
        username: "authenticationError",
        password: ""
      });
      client.on("connect", function() {
        client.end();
        done(new Error("Expected connection error"));
      });
      client.on("error", function(error) {
        client.end();
        expect(error.message).to.eql("Connection refused: Bad username or password");
        done();
      });
    });

    it("should throw a connection error if the user is not authorized", function(done){
      var client = mqtt.connect('mqtt://localhost:' + settings.mqtt.port, {
        username: "authenticationError",
        password: ""
      });
      client.on("connect", function() {
        client.end();
        done(new Error("Expected connection error"));
      });
      client.on("error", function(error) {
        client.end();
        expect(error.message).to.eql("Connection refused: Bad username or password");
        done();
      });
    });

    it("should close the connection if an unauthorized publish is attempted", function(done) {
      var client = mqtt.connect('mqtt://localhost:' + settings.mqtt.port);
      var error;
      client.on("message", function() {
        error = new Error("Expected connection close");
        client.end();
      });
      var closeListener = function() {
        client.removeListener("close", closeListener);
        if(error) {
          done(error);
        } else {
          client.end();
          done();
        }
      };
      client.on("close", closeListener);
      client.subscribe("unauthorizedPublish")
        .publish("unauthorizedPublish", "world");
    });

    it("should denny the subscription when an unauthorized subscribe is attempted", function(done) {
      var client = mqtt.connect('mqtt://localhost:' + settings.mqtt.port);
      client.subscribe("unauthorizedSubscribe", function(err, subscribes) {
        client.end();
        expect(subscribes[0].qos).to.eql(0x80);
        done();
      });
    });

  });

});
