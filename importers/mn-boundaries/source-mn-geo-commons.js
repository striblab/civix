/**
 * MN Geospatial Commons
 */

// Constants
const SOURCE_ID = 'civix-core-data-mn-geospatial-commons';

// Function to ensure source is there
module.exports = async ({ models, transaction }) => {
  return await models.Source.findOrCreate({
    where: { id: SOURCE_ID },
    defaults: {
      id: SOURCE_ID,
      name: SOURCE_ID,
      title: 'Minnesota Geospatial Commons',
      url: 'https://gisdata.mn.gov/'
    },
    transaction
  });
};
