/**
 * This is an example importer.
 */

/**
 * An importer should be a JS module that exports
 * an import function.  The function should return
 * a promise with ??
 *
 * The function will be passed an object with the following
 * properties:
 *
 * * logger: Winston logger function (with prefix argument)
 * * config: Config object
 * * models: Object with all the models
 * * db: Database/sequelize instance
 */
module.exports = async function exampleImporter({ logger, models }) {
  logger('info', 'Running example importer...');

  console.log(models);
};
