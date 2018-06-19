/**
 * Main include.
 */

const tools = {
  models: require('./models'),
  config: require('./config')
};
console.log(tools);

tools.config.db.sync().then(console.log);

module.exports = tools;
