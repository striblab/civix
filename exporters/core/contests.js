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
    where: {
      election_id: 'mn-20180814'
    },
    include: [
      { all: true },
      // More than one-level in needs to be explicitly added ?
      {
        model: models.Result,
        include: [models.Candidate]
      },
      {
        model: models.Office,
        include: [models.Body]
      }
    ]
  });

  // Get election
  let election = await contests[0].getElection();

  // Turn to json
  let simpleContests = _.map(contests, c => c.get({ plain: true }));

  // Create base path
  let electionContestsPath = path.join(argv.output, election.id, 'contests');
  try {
    fs.mkdirpSync(electionContestsPath);
  }
  catch (e) {
    logger('error', `Unable to create path: ${electionContestsPath}`);
    throw e;
  }

  // Output all
  let allPath = path.join(electionContestsPath, 'all.json');
  fs.writeFileSync(allPath, JSON.stringify(simpleContests));

  // Each contest
  let byContestPath = path.join(electionContestsPath, 'contests');
  fs.mkdirpSync(byContestPath);
  _.each(simpleContests, c => {
    fs.writeFileSync(
      path.join(byContestPath, `${c.id}.json`),
      JSON.stringify(c)
    );
  });

  // By body
  let byBodyPath = path.join(electionContestsPath, 'by-body');
  fs.mkdirpSync(byBodyPath);
  _.each(_.groupBy(simpleContests, c => c.office.body_id), (g, gi) => {
    fs.writeFileSync(
      path.join(byBodyPath, `${gi || gi !== 'null' ? gi : 'no-body'}.json`),
      JSON.stringify(g)
    );
  });

  // By office
  let byOfficePath = path.join(electionContestsPath, 'by-office');
  fs.mkdirpSync(byOfficePath);
  _.each(_.groupBy(simpleContests, c => c.office_id), (g, gi) => {
    fs.writeFileSync(
      path.join(byOfficePath, `${gi || gi !== 'null' ? gi : 'no-office'}.json`),
      JSON.stringify(g)
    );
  });
};
