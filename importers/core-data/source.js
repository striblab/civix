/**
 * Common function to ensure that the core data source is there
 */

// Constants
const SOURCE_ID = 'civix-core-data-importer';

// Function to ensure source is there
module.exports = async ({ models }) => {
  let s = await models.Source.findOrCreate({
    where: { id: SOURCE_ID },
    defaults: {
      id: SOURCE_ID,
      name: SOURCE_ID,
      title: 'Civix Core Data Importer'
    }
  });

  return s;
};
