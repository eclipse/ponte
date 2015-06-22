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
var ponte = require("../lib/ponte");
var mqtt = require("mqtt");

describe("Ponte as an HTTP API", function() {

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

    it("should POST and GET a topic and its payload", function(done) {
      request(instance.http.server)
        .post("/resources/hello")
        .set("content-type", "text/plain")
        .send("hello world")
        .expect(204, function() {
          request(instance.http.server)
            .get("/resources/hello")
            .expect(200, "hello world", done);
        });
    });

    it("should publish a value to MQTT after PUT", function(done) {
      mqtt.connect('mqtt://localhost:' + settings.mqtt.port)

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
          expect(payload.toString()).to.eql("world");
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

    it("should GET the index and return a 404", function(done) {
      request(instance.http.server)
        .get("")
        .expect(404, done);
    });

    it("should handle CORS headers", function(done) {
      request(instance.http.server)
        .options("/resources/hello")
        .set('Origin', 'http://somehost.org')
        .expect('Access-Control-Allow-Origin', 'http://somehost.org')
        .expect('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS, XMODIFY')
        .expect('Access-Control-Max-Age', '86400')
        .expect('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept')
        .expect(200, done);
    });
  
  });
  
  describe("with auth problems", function() {
  
    beforeEach(function(done){
      settings = ponteSettings();
      
      settings.http.authenticate = function(req, callback) {
        if(req.url === "/resources/unauthenticated") {
          callback(null, false);
        } else {
          var subject = {};
          callback(null, true, subject);
        }
      };
      settings.http.authorizeGet = function(subject, topic, callback) {
        if(topic === "unauthorizedGet") {
          callback(null, false);
        } else {
          callback(null, true);
        }
      };
      settings.http.authorizePut = function(subject, topic, payload, callback) {
        if(topic === "unauthorizedPut") {
          callback(null, false);
        } else {
          callback(null, true);
        }
      };
      
      instance = ponte(settings, done);
    });
    
    afterEach(function(done){
      instance.close(done);
    });
    
    it("should return 401 if a request cannot be authenticated", function(done){
      request(instance.http.server)
        .get("/resources/unauthenticated")
        .expect(401, done);
    });
    
    it("should return 403 if a GET request is not authorized", function(done){
      request(instance.http.server)
        .get("/resources/unauthorizedGet")
        .expect(403, done);
    });
    
    it("should return 403 if a PUT request is not authorized", function(done){
      request(instance.http.server)
        .put("/resources/unauthorizedPut")
        .set("content-type", "text/plain")
        .send("hello world")
        .expect(403, done);
    });
  
  });
  
});
