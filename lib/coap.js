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

var coap = require('coap');
var rRegexp = /^\/r\/(.+)$/;
var callback = require("callback-stream");

function CoAP(opts, done) {
  if (!(this instanceof CoAP)) {
    return new CoAP(opts, done);
  }

  if (typeof opts === "function") {
    done = opts;
    opts = {};
  }

  var that = this;

  this._persistence = opts.ponte.persistence;
  this._broker = opts.ponte.broker;
  this._ponte = opts.ponte;
  
  if (typeof opts.authenticate === "function") {
    this.authenticate = opts.authenticate;
  }
  
  if (typeof opts.authorizeGet === "function") {
    this.authorizeGet = opts.authorizeGet;
  }
  
  if (typeof opts.authorizePut === "function") {
    this.authorizePut = opts.authorizePut;
  }

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
      that.authenticate(req, function(err, authenticated, subject) {
        if (err) {
          that._handleAuthError(err, res);
          return;
        }
        
        if (!authenticated) {
          that._handleNotAuthenticated(res);
          return;
        }
        
        if (req.method === 'GET') {
          that.authorizeGet(subject, topic, function(err, authorized) {
            if (err) {
              that._handleAuthError(err, res);
              return;
            }
            
            if (!authorized) {
              that._handleNotAuthorized(res);
              return;
            }
            
            that._handleGET(topic, req, res);
          });
        } else if (req.method === 'PUT') {
          req.pipe(callback(function(err, payload) {
            payload = Buffer.concat(payload);
            
            that.authorizePut(subject, topic, payload, function(err, authorized) {
              if (err) {
                that._handleAuthError(err, res);
                return;
              }
              
              if (!authorized) {
                that._handleNotAuthorized(res);
                return;
              }
              
              that._handlePUT(topic, payload, res);
            });
            
          }));
        }
      });
    } else {
      res.statusCode = '4.04';
      res.end();
    }
  });

  this.server.listen(opts.port, opts.host, function(err) {
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

CoAP.prototype._handlePUT = function(topic, payload, res) {
  var that = this;
  
  var packet = { topic: topic, payload: payload, retain: true };

  that._persistence.storeRetained(packet, function() {
    that._broker.publish(topic, payload, {}, function() {
      res.setOption('Location-Path', '/r/' + topic);
      res.statusCode = '2.04';
      res.end();

      that._ponte.emit('updated', topic, payload);
    });
  });
};


/**
 * The function that will be used to authenticate requests.
 * This default implementation authenticates everybody.
 * The returned subject is just a new Object.
 *
 * @param {Object} req The incoming message @link https://github.com/mcollina/node-coap#incoming
 * @param {Function} cb The callback function. Has the following structure: cb(err, authenticated, subject)
 */
CoAP.prototype.authenticate = function(req, cb) {
  cb(null, true, {});
};

/**
 * The function that will be used to authorize subjects to GET messages from topics.
 * This default implementation authorizes everybody.
 * 
 * @param {Object} subject The subject returned by the authenticate function
 * @param {string} topic The topic
 * @param {Function} cb The callback function. Has the following structure: cb(err, authorized)
 */
CoAP.prototype.authorizeGet = function(subject, topic, cb) {
  cb(null, true);
};

/**
 * The function that will be used to authorize subjects to PUT messages to topics.
 * This default implementation authorizes everybody.
 * 
 * @param {Object} subject The subject returned by the authenticate function
 * @param {string} topic The topic
 * @param {Buffer} payload The payload
 * @param {Function} cb The callback function. Has the following structure: cb(err, authorized)
 */
CoAP.prototype.authorizePut = function(subject, topic, payload, cb) {
  cb(null, true);
};

CoAP.prototype._handleAuthError = function(err, res) {
  this._logger.info(err);
  res.statusCode = '5.00';
  res.end();
};

CoAP.prototype._handleNotAuthenticated = function(res) {
  this._logger.info('authentication denied');
  res.statusCode = '4.01';
  res.end();
};

CoAP.prototype._handleNotAuthorized = function(res) {
  this._logger.info('not authorized');
  res.statusCode = '4.03';
  res.end();
};

module.exports = CoAP;
