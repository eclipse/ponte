var request = require("supertest");
var ponte = require("../lib/ponte");
var async = require("async");
var fs = require("fs");

describe("Ponte as an HTTP server that serves libraries", function() {

  var settings;
  var instance;
  
  function remove() {
    try {
      fs.unlinkSync(__dirname + "/.hidden/mqttws31.js");
      fs.unlinkSync(__dirname + "/.hidden/mqtt.js");
      fs.rmdirSync(__dirname + "/.hidden");
    } catch (e) {
      return e.code != 'NOENT';
    }
    return true;
  }

  function cp(opts, done) {
    var toStream = fs.createWriteStream(opts.to);
    fs.createReadStream(opts.from).pipe(toStream);
    toStream.on("finish", done);
  }

  function prepare(defaults, newSettings, done) {
    defaults.http.publicDirs = {
      ponte: __dirname + "/../public",
      mosca: __dirname + "/../node_modules/mosca/public"
    };
    if (!remove())
      return done(new Error("Failed to remove test artifacts from previous attempt."));
    try {
      fs.mkdirSync(__dirname + "/.hidden");
    } catch (e) {
      return done(new Error("Failed to create .hidden directory."));
    }
    async.map([
      { 
        from: defaults.http.publicDirs.ponte + "/mqttws31.js", 
        to: newSettings.http.publicDirs.ponte + "/mqttws31.js"
      },
      { 
        from: defaults.http.publicDirs.mosca + "/mqtt.js", 
        to: newSettings.http.publicDirs.mosca + "/mqtt.js"
      },
    ], cp, done);
  }

  beforeEach(function(done) {
    settings = ponteSettings();
    settings.http.publicDirs = {
      ponte: __dirname + "/.hidden",
      mosca: __dirname + "/.hidden"
    };
    prepare(ponteSettings(), settings, function(err){
      if (err)
        return done(err);
      instance = ponte(settings, done);
    });
  });

  afterEach(function(done) {
    instance.close(function(err){
      if (!remove())
        return done(new Error("Failed to cleanup the test artifacts"));
      done(err);
    });
  });

  describe("with libraries inside the " + __dirname + "/.hidden directory", function() {
    it("should serve the mqttws31.js file", function(done) {
      var file = fs.readFileSync(__dirname + "/../public/mqttws31.js");
      request(instance.http.server)
        .get("/mqttws31.js")
        .expect(200, file.toString(), done);
    });

    it("should serve the mqtt.js file", function(done) {
      var file = fs.readFileSync(__dirname + "/../node_modules/mosca/public/mqtt.js");
      request(instance.http.server)
        .get("/mqtt.js")
        .expect(200, file.toString(), done);
    });
  });
});
