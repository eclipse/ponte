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

var async = require("async");
var servers = require("./servers.js");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var xtend = require("xtend");

function Ponte(opts, done) {
  if (!(this instanceof Ponte)) {
    return new Ponte(opts, done);
  }

  if (typeof opts === "function") {
    done = opts;
    opts = {};
  }

  this.options = opts;

  var that = this;

  async.eachSeries(servers, function(obj, cb) {
    opts[obj.service] = xtend(obj.defaults, opts[obj.service]);
    opts[obj.service].ponte = that;
    obj.factory(opts[obj.service], function(err, instance) {
      that[obj.service] = instance;
      cb(err);
    });
  }, function(err) {
    if (done) {
      done(err, that);
    }
  });
}

util.inherits(Ponte, EventEmitter);

Ponte.prototype.close = function close(done) {
  var that = this;
  var reversed = [].concat(servers).reverse();
  async.eachSeries(reversed, function closeEverything(obj, cb) {
    if (typeof that[obj.service].close === "function") {
      that[obj.service].close(cb);
    } else {
      cb();
    }
  }, done);
};

Ponte.cli = require("./cli");

module.exports = Ponte;
