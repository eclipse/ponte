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

var http = require("http");
var resourcesRegexp = /^\/resources\/(.+)$/;
var callback = require("callback-stream");
var bunyan = require("bunyan");

function HTTP(opts, done) {
  if (!(this instanceof HTTP)) {
    return new HTTP(opts, done);
  }

  if (typeof opts === "function") {
    cb = opts;
    opts = {};
  }

  var that = this;
  this._persistence = opts.ponte.persistence;
  this._ponte = opts.ponte;
  var logger = this._logger = opts.ponte.logger.child({
    service: 'HTTP',
    serializers: {
      req: bunyan.stdSerializers.req,
      res: bunyan.stdSerializers.res
    }
  });
  this.server = http.createServer(this.buildServer(opts));
  this.server.listen(opts.port, function(err) {
    done(err, that);
    logger.info({ port: opts.port }, "server started");
  });
}

HTTP.prototype.close = function(done) {
  this.server.close(done);
};

HTTP.prototype.buildServer = function(opts) {
  var logger = this._logger;
  var persistence = this._persistence;
  var ponte = this._ponte;

  function handleGetResource(req, res) {
    var match = req.url.match(resourcesRegexp);
    if (req.method !== 'GET' && match) {
      return false;
    }

    var topic = match[1];

    persistence.lookupRetained(topic, function(err, packets) {
      if (packets.length === 0) {
        res.statusCode = 404;
        res.end('Not found');
      } else {
        res.end(packets[0].payload);
      }
    });

    return true;
  }

  function handlePutResource(req, res) {
    var match = req.url.match(resourcesRegexp);
    if (req.method !== 'PUT' && match) {
      return false;
    }

    var topic = match[1];

    req.pipe(callback(function(err, payload) {
      payload = payload.toString();
      var packet = { topic: topic, payload: payload, retain: true };
      persistence.storeRetained(packet, function() {
        ponte.broker.publish(topic, payload, {}, function() {
          res.setHeader('Location', '/resources/' + topic);
          res.statusCode = 204;
          res.end();
          ponte.emit('updated', topic, new Buffer(payload));
        });
      });
    }));

    return true;
  }

  return function httpServer(req, res) {
    logger.info({ req: req });

    res.on('finish', function() {
      logger.info({ res: res });
    });

    var handled =
      handleGetResource(req, res) ||
      handlePutResource(req, res);


    if (!handled) {
      res.statusCode = 404;
      res.end('Not found');
    }
  };
};

module.exports = HTTP;
