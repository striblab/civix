/**
 * Minnesota via API
 */

// Constants
const SOURCE_ID = 'mn-elections-api';

// Function to ensure source is there
module.exports = async ({ models, transaction }) => {
  return await models.Source.findOrCreate({
    where: { id: SOURCE_ID },
    defaults: {
      id: SOURCE_ID,
      name: SOURCE_ID,
      title: 'Minnesota election results from the Secretary of State via API',
      url: 'https://github.com/striblab/mn-elections-api'
    },
    transaction
  });
};
