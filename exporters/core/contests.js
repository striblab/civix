/**
 * Export contests for an election.
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');

// Export function
module.exports = async ({ logger, config, models, db, argv }) => {
  // Make query
  let contests = await models.Contest.findAll({
    where: {
      election_id: 'mn-20180814'
    },
    include: [
      {
        all: true,
        attributes: { exclude: ['sourceData'] }
      },
      {
        model: models.Result,
        attributes: { exclude: ['sourceData'] },
        // Just top results
        where: { subResult: false },
        include: [
          {
            model: models.Candidate,
            attributes: { exclude: ['sourceData'] }
          }
        ]
      },
      {
        model: models.Result,
        attributes: { exclude: ['sourceData'] },
        // Sub results
        where: { subResult: true },
        as: 'subResults'
      },
      {
        model: models.Office,
        attributes: { exclude: ['sourceData'] },
        include: [
          {
            model: models.Body,
            attributes: { exclude: ['sourceData'] }
          }
        ]
      }
    ]
  });

  // Get election
  let election = await contests[0].getElection();

  // Turn to json
  let simpleContests = _.map(contests, c => {
    let p = c.get({ plain: true });

    // Group sub results
    p.subResults = _.mapValues(_.groupBy(p.subResults, 'division_id'), g =>
      _.groupBy(g, 'boundary_version_id')
    );

    return p;
  });

  // Just top level results
  let topResults = _.map(simpleContests, c => _.omit(c, 'subResults'));

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
  fs.writeFileSync(allPath, JSON.stringify(topResults));

  // Each contest
  let byContestPath = path.join(electionContestsPath, 'contests');
  fs.mkdirpSync(byContestPath);
  _.each(topResults, c => {
    fs.writeFileSync(
      path.join(byContestPath, `${c.id}.json`),
      JSON.stringify(c)
    );
  });

  // Each contest (with sub results)
  fs.mkdirpSync(byContestPath);
  _.each(simpleContests, c => {
    fs.writeFileSync(
      path.join(byContestPath, `${c.id}.sub-results.json`),
      JSON.stringify(c)
    );
  });

  // By body (and then office)
  let byBodyPath = path.join(electionContestsPath, 'by-body');
  fs.mkdirpSync(byBodyPath);
  _.each(_.groupBy(topResults, c => c.office.body_id), (g, gi) => {
    let body =
      gi && gi !== 'null'
        ? _.cloneDeep(g[0].office.body)
        : { id: 'no-body', noBody: true };
    body.offices = _.mapValues(_.groupBy(g, o => o.office_id), o => {
      let office = _.cloneDeep(o[0].office);
      office.contests = o;
      return office;
    });

    fs.writeFileSync(
      path.join(byBodyPath, `${body.id}.json`),
      JSON.stringify(body)
    );
  });

  // By office
  let byOfficePath = path.join(electionContestsPath, 'by-office');
  fs.mkdirpSync(byOfficePath);
  _.each(_.groupBy(topResults, c => c.office_id), (g, gi) => {
    let office =
      gi && gi !== 'null'
        ? _.cloneDeep(g[0].office)
        : { id: 'no-contest', noContest: true };
    office.contests = g;

    fs.writeFileSync(
      path.join(byOfficePath, `${office.id}.json`),
      JSON.stringify(office)
    );
  });
};
