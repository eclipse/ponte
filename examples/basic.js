var ponte = require("../lib/ponte");
var opts = {
  logger: {
    level: 'info'
  },
  http: {
    port: 3000 // tcp
  },
  mqtt: {
    port: 3001 // tcp
  },
  coap: {
    port: 3000 // udp
  },
  persistence: {
    type: 'level',
    path: './db'
  }
};
var server = ponte(opts);

server.on("updated", function(resource, buffer) {
  console.log("Resource Updated", resource, buffer.toString());
});
