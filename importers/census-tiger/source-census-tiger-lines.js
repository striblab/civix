/**
 * Census tiger lines source
 */

// Constants
const SOURCE_ID = 'civix-core-data-tiger-lines-2017';

// Function to ensure source is there
module.exports = async ({ models, transaction }) => {
  return await models.Source.findOrCreate({
    where: { id: SOURCE_ID },
    defaults: {
      id: SOURCE_ID,
      name: SOURCE_ID,
      title: 'Census Tiger Lines 2017',
      url: 'https://www.census.gov/geo/maps-data/data/tiger-line.html'
    },
    transaction
  });
};
