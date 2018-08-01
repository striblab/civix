/**
 * AP via Elex source
 */

// Constants
const SOURCE_ID = 'civix-ap-elex';

// Function to ensure source is there
module.exports = async ({ models, transaction }) => {
  return await models.Source.findOrCreate({
    where: { id: SOURCE_ID },
    defaults: {
      id: SOURCE_ID,
      name: SOURCE_ID,
      title: 'Associate Press election data via Elex',
      url: 'https://github.com/newsdev/elex'
    },
    transaction
  });
};
