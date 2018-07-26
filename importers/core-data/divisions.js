/**
 * Importer for core data: Divisions
 *
 * Divisions describe jurisdiction divisions, such a
 * state.  They are a way to group jurisdiction.
 */

// Dependencies
const ensureManualSource = require('./source-manual.js');

// Import function
module.exports = async function coreDataDivisionsImporter({
  logger,
  models,
  db
}) {
  logger('info', 'Core data: Divisions importer...');
  let updates = [];

  // Wrap in transaction
  return db.sequelize
    .transaction({}, t => {
      const divisionIncludes = [
        {
          model: models.Division,
          as: 'parent'
        },
        {
          model: models.SourceData,
          as: 'source_data',
          include: {
            model: models.Source
          }
        }
      ];

      // Start promise chain
      return ensureManualSource({ models, transaction: t }).then(source => {
        updates.push(source);

        return createCountry({
          models,
          include: divisionIncludes,
          transaction: t,
          source: source[0]
        }).then(country => {
          updates.push(country);

          return createState({
            models,
            include: divisionIncludes,
            transaction: t,
            source: source[0],
            country: country[0]
          }).then(state => {
            updates.push(state);

            return createStateChildren({
              models,
              include: divisionIncludes,
              transaction: t,
              source: source[0],
              state: state[0]
            }).then(results => {
              updates = updates.concat(results);

              // Find county result
              let county = results[0].find(r => {
                return r.dataValues.id === 'county';
              });
              if (!county) {
                throw new Error('Unable to find county division data.');
              }

              return createCountyChildren({
                models,
                include: divisionIncludes,
                transaction: t,
                source: source[0],
                county
              }).then(results => {
                updates = updates.concat(results);

                // Find county result
                let local = results[0].find(r => {
                  return r.dataValues.id === 'county-local';
                });
                if (!local) {
                  throw new Error('Unable to find county division data.');
                }

                return createLocalChildren({
                  models,
                  include: divisionIncludes,
                  transaction: t,
                  source: source[0],
                  local
                }).then(results => {
                  updates = updates.concat(results);
                });
              });
            });
          });
        });
      });
    })
    .then(results => {
      console.log(results);
      updates.forEach(u => {
        logger(
          'info',
          `[${u[0].constructor.name}] ${u[1] ? 'Created' : 'Existed'}: ${
            u[0].dataValues.id
          }`
        );
      });
    })
    .catch(error => {
      logger('error', 'Transaction rolled back; no data changes were made.');
      logger('error', error.stack ? error.stack : error);
    });
};

// Create country
function createCountry({ models, include, transaction, source }) {
  return models.Division.findOrCreate({
    where: { id: 'country' },
    include,
    transaction,
    defaults: {
      id: 'country',
      name: 'country',
      title: 'Country',
      sort: 'country',
      source_data: [
        {
          id: 'core-data-division-country',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    }
  });
}

// Create state
function createState({ models, include, transaction, source, country }) {
  return models.Division.findOrCreate({
    where: { id: 'state' },
    include,
    transaction,
    defaults: {
      id: 'state',
      name: 'state',
      title: 'State',
      sort: 'state',
      parent_id: country.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-state',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    }
  });
}

// Create state children
function createStateChildren({ models, include, transaction, source, state }) {
  let children = [
    {
      id: 'county',
      name: 'county',
      title: 'County',
      sort: 'county',
      parent_id: state.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-county',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'congress',
      name: 'congress',
      title: 'Congressional district',
      sort: 'congressional district',
      parent_id: state.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-congress',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'state-upper',
      name: 'state-upper',
      title: 'State upper',
      sort: 'state upper',
      parent_id: state.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-state-upper',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'state-lower',
      name: 'state-lower',
      title: 'State lower',
      sort: 'state lower',
      parent_id: state.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-state-lower',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'water',
      name: 'water',
      title: 'Water district',
      sort: 'water',
      parent_id: state.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-water',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'hospital',
      name: 'hospital',
      title: 'Hopsital',
      sort: 'hospital',
      parent_id: state.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-hospital',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'school',
      name: 'school',
      title: 'School',
      sort: 'school',
      parent_id: state.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-school',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'park-district',
      name: 'park-district',
      title: 'Park district',
      sort: 'park',
      parent_id: state.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-park-district',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'judicial',
      name: 'judicial',
      title: 'Judicial',
      sort: 'judicial',
      parent_id: state.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-judicial',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    }
  ];

  return Promise.all(
    children.map(c => {
      return models.Division.findOrCreate({
        where: { id: c.id },
        include,
        transaction,
        defaults: c
      });
    })
  );
}

// Create county children
function createCountyChildren({
  models,
  include,
  transaction,
  source,
  county
}) {
  let children = [
    {
      id: 'county-local',
      name: 'county-local',
      title: 'Local',
      sort: 'local county',
      parent_id: county.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-county-local',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'county-commissioner',
      name: 'county-commissioner',
      title: 'County commissioner',
      sort: 'county comissioner',
      parent_id: county.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-county-commissioner',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'county-precinct',
      name: 'county-precinct',
      title: 'Precinct',
      sort: 'precinct county',
      parent_id: county.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-county-precinct',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    }
  ];

  return Promise.all(
    children.map(c => {
      return models.Division.findOrCreate({
        where: { id: c.id },
        include,
        transaction,
        defaults: c
      });
    })
  );
}

// Create local children
function createLocalChildren({ models, include, transaction, source, local }) {
  let children = [
    {
      id: 'local-ward',
      name: 'local-ward',
      title: 'Ward',
      sort: 'ward local',
      parent_id: local.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-local-ward',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    },
    {
      id: 'local-park-board',
      name: 'local-park-board',
      title: 'Park board',
      sort: 'park board local',
      parent_id: local.dataValues.id,
      source_data: [
        {
          id: 'core-data-division-local-park-board',
          sourceIdentifier: '',
          data: { manual: true },
          source_id: source.dataValues.id
        }
      ]
    }
  ];

  return Promise.all(
    children.map(c => {
      return models.Division.findOrCreate({
        where: { id: c.id },
        include,
        transaction,
        defaults: c
      });
    })
  );
}
