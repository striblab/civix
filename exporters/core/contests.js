/**
 * Export contests for an election.
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');

// Map Keys deep
const mapKeysDeep = (obj, cb) => {
  if (_.isArray(obj)) {
    return obj.map(innerObj => mapKeysDeep(innerObj, cb));
  }
  else if (_.isObject(obj)) {
    return _.mapValues(_.mapKeys(obj, cb), val => mapKeysDeep(val, cb));
  }
  else {
    return obj;
  }
};

// Export function
module.exports = async ({ logger, config, models, db, argv }) => {
  let contests = await models.Contest.findAll({
    include: [
      { all: true },
      // This is needed to pick up the Candidate info
      // for the results.
      {
        model: models.Result,
        include: [models.Candidate]
      }
    ]
  });

  // Get election
  let election = await contests[0].getElection();

  // Turn to json
  let simpleContests = _.map(contests, c => c.get({ plain: true }));

  // Create base path
  let electionPath = path.join(argv.output, election.id);
  try {
    fs.mkdirpSync(electionPath);
  }
  catch (e) {
    logger('error', `Unable to create path: ${electionPath}`);
    throw e;
  }

  // Output all
  let allPath = path.join(electionPath, 'all.json');
  fs.writeFileSync(allPath, JSON.stringify(simpleContests));

  // Each contest
  let byContestPath = path.join(electionPath, 'contests');
  fs.mkdirpSync(byContestPath);
  _.each(simpleContests, c => {
    fs.writeFileSync(
      path.join(byContestPath, `${c.id}.json`),
      JSON.stringify(c)
    );
  });

  // By body
  let byBodyPath = path.join(electionPath, 'bodies');
  fs.mkdirpSync(byBodyPath);
  _.each(_.groupBy(simpleContests, c => c.office.body_id), (g, gi) => {
    fs.writeFileSync(
      path.join(byBodyPath, `${gi || gi !== 'null' ? gi : 'no-body'}.json`),
      JSON.stringify(g)
    );
  });

  // By office
  let byOfficePath = path.join(electionPath, 'offices');
  fs.mkdirpSync(byOfficePath);
  _.each(_.groupBy(simpleContests, c => c.office_id), (g, gi) => {
    fs.writeFileSync(
      path.join(byOfficePath, `${gi || gi !== 'null' ? gi : 'no-office'}.json`),
      JSON.stringify(g)
    );
  });
};
