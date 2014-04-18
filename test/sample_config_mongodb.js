module.exports = {
  persistence: {
    // same as http://mcollina.github.io/mosca/docs/lib/persistence/mongo.js.html
    type: "mongo",
    url: "mongodb://localhost:27017/ponte"
  },
  broker: {
    // same as https://github.com/mcollina/ascoltatori#mongodb
    type: "mongo",
    url: "mongodb://localhost:27017/ponte"
  },
  logger: {
    level: 20,
    name: "Config Test Logger"
  }
};
