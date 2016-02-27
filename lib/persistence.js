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

var persistences = Object.create(require("mosca").persistence);
persistences.level = persistences.LevelUp;
persistences.redis = persistences.Redis;
persistences.memory = persistences.Memory;
persistences.mongo = persistences.Mongo;

module.exports = function(opts, done) {
  var factory = persistences[opts.type];

  if (opts.type === "memory") {
    done(null, factory(opts));
  } else {
    factory(opts, done);
  }
};
