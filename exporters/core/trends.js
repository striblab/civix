/**
 * Export trends for an election.
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const { pruneEmpty } = require('../../lib/collections.js');
const moment = require('moment-timezone');
moment.tz.setDefault('America/New_York');

// Export function
module.exports = async ({ logger, models, argv }) => {
  // Get election
  if (!argv.election) {
    throw new Error(
      'Make sure to include the --election option, for instance: --election=2018-11-05'
    );
  }

  // Make sure there is actually an election there
  let electionRecord = await models.Election.findOne({
    where: { date: argv.election }
  });
  if (!electionRecord) {
    throw new Error(
      `Unable to find any election records for: ${argv.election}`
    );
  }

  // Create base path
  let electionTrendsPath = path.join(
    argv.output,
    moment(electionRecord.get('date')).format('YYYY-MM-DD'),
    'trends'
  );
  try {
    fs.mkdirpSync(electionTrendsPath);
  }
  catch (e) {
    logger.error(`Unable to create path: ${electionTrendsPath}`);
    throw e;
  }

  // Make query
  let trends = await models.Trends.findAll({
    where: {
      '$election.date$': electionRecord.get('date')
    },
    order: [
      ['sort', 'ASC'],
      ['title', 'ASC'],
      [{ model: models.Body }, 'sort', 'ASC'],
      [{ model: models.Party }, 'sort', 'ASC']
    ],
    include: [
      // Default all does not get nested parts
      {
        all: true,
        attributes: { exclude: ['sourceData'] }
      }
    ]
  });

  // Turn to json
  let simpleTrends = _.map(trends, c => {
    let p = c.get({ plain: true });
    return pruneEmpty(p);
  });

  // Output all
  // let allPath = path.join(electionTrendsPath, 'all.json');
  // fs.writeFileSync(allPath, JSON.stringify(simpleTrends));

  // Group by body
  let byBodyPath = path.join(electionTrendsPath, 'by-body');
  try {
    fs.mkdirpSync(byBodyPath);
  }
  catch (e) {
    logger.error(`Unable to create path: ${byBodyPath}`);
    throw e;
  }

  let byBody = _.map(_.groupBy(simpleTrends, 'body_id'), group => {
    let b = _.cloneDeep(group[0].body);
    b.trends = _.map(group, t => _.omit(t, ['body']));
    return b;
  });

  // Output by body
  _.each(byBody, body => {
    fs.writeFileSync(
      path.join(byBodyPath, `${body.id}.json`),
      JSON.stringify(body)
    );
  });
};
