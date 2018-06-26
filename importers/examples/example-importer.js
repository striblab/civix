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
 *  * config
 *  * logger (Winston instance)
 *  * models
 */
module.exports = async function exampleImporter(tools) {
  tools.logger.p('info', 'Running example importer...');

  console.log(tools.db);
};
