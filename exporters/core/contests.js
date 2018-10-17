/**
 * Export contests for an election.
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');
moment.tz.setDefault('America/New_York');

// Export function
module.exports = async ({ logger, config, models, db, argv }) => {
  // Get election
  if (!argv.election) {
    throw new Error(
      'Make sure to include the --election option, for instance: --election=2018-11-05'
    );
  }

  // Make sure there is actually an election there
  let electionRecord = await models.Election.findOne({
    where: { date: new Date(argv.election) }
  });
  if (!electionRecord) {
    throw new Error(
      `Unable to find any election records for: ${argv.election}`
    );
  }

  // Create base path
  let electionContestsPath = path.join(
    argv.output,
    moment(electionRecord.get('date')).format('YYYY-MM-DD'),
    'contests'
  );
  try {
    fs.mkdirpSync(electionContestsPath);
  }
  catch (e) {
    logger('error', `Unable to create path: ${electionContestsPath}`);
    throw e;
  }
  console.log(electionContestsPath);

  // Make query
  let contests = await models.Contest.findAll({
    where: {
      '$election.date$': electionRecord.get('date')
    },
    order: [
      ['sort', 'ASC'],
      ['title', 'ASC'],
      //[{ model: models.Result, as: 'results' }, 'winner', 'DESC'],
      [{ model: models.Result }, 'winner', 'DESC'],
      [{ model: models.Result }, 'percent', 'DESC'],
      [{ model: models.Party }, 'sort', 'ASC'],
      [{ model: models.Result }, { model: models.Candidate }, 'sort', 'ASC']
    ],
    include: [
      // Default all does not get nested parts
      {
        all: true,
        attributes: { exclude: ['sourceData'] }
      },
      // Results
      {
        model: models.Result,
        attributes: { exclude: ['sourceData'] },
        include: [
          {
            model: models.Candidate,
            attributes: { exclude: ['sourceData'] },
            include: [
              {
                model: models.Party,
                attributes: { exclude: ['sourceData'] }
              }
            ]
          }
        ]
      },
      // Office
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

  // Turn to json
  let simpleContests = _.map(contests, c => {
    let p = c.get({ plain: true });

    // Group sub results
    p.subResults = _.mapValues(_.groupBy(p.subResults, 'division_id'), g =>
      _.groupBy(g, 'boundary_version_id')
    );

    return pruneEmpty(p);
  });

  // Just top level results
  let topResults = _.map(simpleContests, c => _.omit(c, 'subResults'));

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
    if (!c.subResults || _.isEmpty(c.subResults)) {
      return;
    }

    fs.writeFileSync(
      path.join(byContestPath, `${c.id}.sub-results.json`),
      JSON.stringify(c)
    );
  });

  // By body (and then office)
  let byBodyPath = path.join(electionContestsPath, 'by-body');
  fs.mkdirpSync(byBodyPath);
  _.each(
    _.groupBy(topResults, c => {
      return c.office.body_id;
    }),
    (g, gi) => {
      let body =
        gi && gi !== 'null'
          ? _.cloneDeep(g[0].office.body)
          : { id: 'no-body', noBody: true };
      if (!body) {
        return;
      }

      body.offices = _.mapValues(_.groupBy(g, o => o.office_id), o => {
        let office = _.cloneDeep(o[0].office);
        office.contests = o;
        return office;
      });

      // All offices in body
      fs.writeFileSync(
        path.join(byBodyPath, `${body.id}.json`),
        JSON.stringify(body)
      );

      // Break up into contested and uncontested.  For an office with a
      // partisan primary, both contests must be uncontested
      let contested = _.cloneDeep(body);
      contested.offices = filterValues(contested.offices, o => {
        let uncontested = true;
        o.contests.forEach(c => {
          uncontested = c.uncontested === false ? false : uncontested;
        });
        return !uncontested;
      });
      fs.writeFileSync(
        path.join(byBodyPath, `${body.id}.contested.json`),
        JSON.stringify(contested)
      );

      let uncontested = _.cloneDeep(body);
      uncontested.offices = filterValues(uncontested.offices, o => {
        let uncontested = true;
        o.contests.forEach(c => {
          uncontested = c.uncontested === false ? false : uncontested;
        });
        return uncontested;
      });
      fs.writeFileSync(
        path.join(byBodyPath, `${body.id}.uncontested.json`),
        JSON.stringify(uncontested)
      );
    }
  );

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

// Filter object and keep keys
function filterValues(object, filter) {
  filter = filter || identity;
  return Object.keys(object).reduce(function(x, key) {
    var value = object[key];
    if (filter(value)) {
      x[key] = value;
    }
    return x;
  }, {});
}

// REcursive clean
function pruneEmpty(obj) {
  return (function prune(current) {
    _.forOwn(current, function(value, key) {
      if (
        _.isUndefined(value) ||
        _.isNull(value) ||
        _.isNaN(value) ||
        (!_.isDate(value) && _.isString(value) && _.isEmpty(value)) ||
        (!_.isDate(value) && _.isObject(value) && _.isEmpty(prune(value)))
      ) {
        delete current[key];
      }
    });
    // remove any leftover undefined values from the delete
    // operation on an array
    if (_.isArray(current)) _.pull(current, undefined);

    return current;
  })(_.cloneDeep(obj)); // Do not modify the original object, create a clone instead
}
