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
    order: [
      ['sort', 'ASC'],
      ['title', 'ASC'],
      [{ model: models.Result, as: 'results' }, 'winner', 'DESC'],
      [{ model: models.Result, as: 'results' }, 'percent', 'DESC'],
      [{ model: models.Party }, 'sort', 'ASC'],
      [
        { model: models.Result, as: 'results' },
        { model: models.Candidate },
        'sort',
        'ASC'
      ],
      [{ model: models.Result, as: 'subResults' }, 'percent', 'DESC'],
      [
        { model: models.Result, as: 'subResults' },
        { model: models.Candidate },
        'sort',
        'ASC'
      ]
    ],
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
      {
        model: models.Result,
        attributes: { exclude: ['sourceData'] },
        // Sub results
        where: { subResult: true },
        as: 'subResults',
        required: false,
        include: [
          {
            model: models.Candidate,
            attributes: { exclude: ['sourceData'] }
          }
        ]
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

  // Get divisions
  let divisions = _.keyBy(
    _.map(
      await models.Division.findAll({
        attributes: { exclude: ['sourceData'] }
      }),
      d => d.get({ plain: true })
    ),
    'id'
  );

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
  _.each(_.groupBy(topResults, c => c.office.body_id), (g, gi) => {
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
  });

  // (Loosely) by boundary
  let byBoundaryPath = path.join(electionContestsPath, 'by-boundary');
  fs.mkdirpSync(byBoundaryPath);
  _.each(
    _.groupBy(topResults, c =>
      c.office.boundary_id
        .replace(/(-[0-9]+|-[a-z])(-|$)/gi, '$2')
        .replace(/(-[0-9]+|-[a-z])(-|$)/gi, '$2')
    ),
    (g, gi) => {
      fs.writeFileSync(
        path.join(byBoundaryPath, `${gi}.json`),
        JSON.stringify(g)
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
