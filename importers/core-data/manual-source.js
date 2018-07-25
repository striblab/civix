/**
 * Common function to ensure that the core data source is there
 * for any manual data in these importers.
 */

// Constants
const SOURCE_ID = 'civix-core-data-importer-manual';

// Function to ensure source is there
module.exports = async ({ models, transaction }) => {
  return await models.Source.findOrCreate({
    where: { id: SOURCE_ID },
    defaults: {
      id: SOURCE_ID,
      name: SOURCE_ID,
      title: 'Civix manual core data importer'
    },
    transaction
  });
};
