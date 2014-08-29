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

global.sinon = require("sinon");
global.chai = require("chai");
global.expect = require("chai").expect;

var portCounter = 30042;
global.nextPort = function() {
  return ++portCounter;
};

var bunyan = require("bunyan");

global.ponteSettings = function() {
  return {
    logger: {
      name: "ponteTests",
      level: 60
    },
    http: {
      port: nextPort()
    },
    coap: {
      port: nextPort()
    },
    mqtt: {
      port: nextPort()
    }
  };
};
