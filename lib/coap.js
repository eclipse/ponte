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

var coap = require('coap');
var rRegexp = /^\/r\/(.+)$/;
var callback = require("callback-stream");

function CoAP(opts, done) {
  if (!(this instanceof CoAP)) {
    return new CoAP(opts, done);
  }

  if (typeof opts === "function") {
    cb = opts;
    opts = {};
  }

  var that = this;

  this._persistence = opts.ponte.persistence;
  this._broker = opts.ponte.broker;
  this._ponte = opts.ponte;

  var logger = this._logger = opts.ponte.logger.child({ service: 'CoAP' });

  this.server = coap.createServer(function handler(req, res) {
    var match = req.url.match(rRegexp);
    var topic;

    req.on('error', function(err) {
      logger.info(err);
    });

    res.on('error', function(err) {
      logger.info(err);
    });

    logger.info({ url: req.url, code: req.code, sender: req.rsinfo, headers: req.headers }, 'request received');

    if (match) {
      topic = match[1];
      if (req.method === 'GET') {
        that._handleGET(topic, req, res);
      } else if (req.method === 'PUT') {
        that._handlePUT(topic, req, res);
      }
    } else {
      res.statusCode = '4.04';
      res.end();
    }
  });

  this.server.listen(opts.port, function(err) {
    done(err, that);
    logger.info({ port: opts.port }, "server started");
  });
}

CoAP.prototype.close = function(done) {
  this.server.close(done);
};

CoAP.prototype._handleGET = function(topic, req, res) {
  var that = this;
  var deliver = 'end';
  var logger = this._logger;
  var cb = function(topic, payload) {
    logger.debug({ url: req.url, code: req.code, sender: req.rsinfo }, 'sending update');
    res.write(payload);
  };

  that._persistence.lookupRetained(topic, function(err, packets) {
    if (packets.length === 0) {
      logger.info({ url: req.url, code: req.code, sender: req.rsinfo }, 'not found');
      res.statusCode = '4.04';
      return res.end();
    }

    if (req.headers.Observe === 0) {
      logger.debug({ url: req.url, code: req.code, sender: req.rsinfo }, 'registering for topic');

      deliver = 'write';
      that._broker.subscribe(topic, cb);

      req.on('error', function() {
        that._broker.unsubscribe(topic, cb);
      });

      res.on('finish', function() {
        that._broker.unsubscribe(topic, cb);
      });
    }

    logger.debug({ url: req.url, code: req.code, sender: req.rsinfo }, 'delivering retained');

    res[deliver](packets[0].payload);
  });
};

CoAP.prototype._handlePUT = function(topic, req, res) {
  var that = this;

  req.pipe(callback(function(err, payload) {
    payload = Buffer.concat(payload);
    var packet = { topic: topic, payload: payload, retain: true };

    that._persistence.storeRetained(packet, function() {
      that._broker.publish(topic, payload, {}, function() {
        res.setOption('Location-Path', '/r/' + topic);
        res.statusCode = '2.04';
        res.end();

        that._ponte.emit('updated', topic, payload);
      });
    });
  }));
};

module.exports = CoAP;
