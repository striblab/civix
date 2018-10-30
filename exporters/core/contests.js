/**
 * Export contests for an election.
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const lunr = require('lunr');
const { pruneEmpty, filterValues } = require('../../lib/collections.js');
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
  let electionContestsPath = path.join(
    argv.output,
    moment(electionRecord.get('date')).format('YYYY-MM-DD'),
    'contests'
  );
  try {
    fs.mkdirpSync(electionContestsPath);
  }
  catch (e) {
    logger.error(`Unable to create path: ${electionContestsPath}`);
    throw e;
  }

  // Make query
  let contests = await models.Contest.findAll({
    where: {
      '$election.date$': electionRecord.get('date')
    },
    order: [
      ['sort', 'ASC'],
      ['title', 'ASC'],
      [{ model: models.Result }, 'winner', 'DESC'],
      [{ model: models.Result }, 'votes', 'DESC'],
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
    return pruneEmpty(p);
  });

  // Just top level results
  let topContests = _.filter(simpleContests, c => !c.subContest);

  // Sub contests
  let subContests = _.filter(simpleContests, c => c.subContest);

  // Each contest
  let byContestPath = path.join(electionContestsPath, 'contests');
  fs.mkdirpSync(byContestPath);
  _.each(topContests, c => {
    fs.writeFileSync(
      path.join(byContestPath, `${c.id}.json`),
      JSON.stringify(c)
    );
  });

  // Sub contests
  let bySubContestsPath = path.join(electionContestsPath, 'sub-contests');
  fs.mkdirpSync(bySubContestsPath);
  _.each(_.groupBy(subContests, 'parent_id'), (g, gi) => {
    // Then group by division id
    _.each(_.groupBy(g, 'division_id'), (sg, sgi) => {
      fs.writeFileSync(
        path.join(bySubContestsPath, `${gi}.${sgi}.json`),
        JSON.stringify(sg)
      );
    });
  });

  // By body (and then office)
  let byBodyPath = path.join(electionContestsPath, 'by-body');
  fs.mkdirpSync(byBodyPath);
  _.each(
    _.groupBy(_.filter(topContests, c => c.office && c.office.body_id), c => {
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
  _.each(_.groupBy(topContests, c => c.office_id), (g, gi) => {
    let office =
      gi && gi !== 'null'
        ? _.cloneDeep(g[0].office)
        : { id: 'no-contest', noContest: true };

    if (office) {
      office.contests = g;

      fs.writeFileSync(
        path.join(byOfficePath, `${office.id}.json`),
        JSON.stringify(office)
      );
    }
  });

  // Search.
  // Note that though Lunr pre-indexing would save some processing
  // on the client, it actually does not pass the meta data through,
  // and makes a larger size file.
  let searchPath = path.join(electionContestsPath, 'search');
  fs.mkdirpSync(searchPath);
  let contestsForIndex = _.map(topContests, c => {
    // Use small names to save on JSON
    return {
      id: c.id,
      t: c.title,
      d: c.description,
      ot:
        c.office && c.office.title && c.office.title !== c.title
          ? c.office.title
          : undefined,
      oa:
        c.office && c.office.area && c.title.indexOf(c.office.area) === -1
          ? c.office.area
          : undefined,
      osa:
        c.office && c.office.subArea && c.title.indexOf(c.office.subArea) === -1
          ? c.office.subArea
          : undefined
    };
  });

  fs.writeFileSync(
    path.join(searchPath, 'search.json'),
    JSON.stringify(contestsForIndex)
  );

  // let contestIndex = lunr(function() {
  //   this.ref('id');
  //   this.field('t');
  //   //this.field('d');
  //   //this.field('ot');
  //   this.field('oa');
  //   //this.field('osa');

  //   contestsForIndex.forEach(c => {
  //     this.add(c);
  //   });
  // });

  // fs.writeFileSync(
  //   path.join(searchPath, 'index.lunr.json'),
  //   JSON.stringify(contestIndex)
  // );
};
