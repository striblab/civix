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
      // Start promise chain
      return ensureManualSource({ models, transaction: t }).then(source => {
        updates.push(source);

        return createCountry({
          db,
          models,
          include: [{ all: true }],
          transaction: t,
          source: source[0]
        }).then(country => {
          updates.push(country);

          return createState({
            db,
            models,
            transaction: t,
            source: source[0],
            country: country[0]
          }).then(state => {
            updates.push(state);

            return createStateChildren({
              db,
              models,
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
                db,
                models,
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
                  db,
                  models,
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
function createCountry({ db, models, transaction, source }) {
  return db.findOrCreateOne(models.Division, {
    where: { id: 'country' },
    transaction,
    defaults: {
      id: 'country',
      name: 'country',
      title: 'Country',
      sort: 'country',
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    }
  });
}

// Create state
function createState({ db, models, transaction, source, country }) {
  return db.findOrCreateOne(models.Division, {
    where: { id: 'state' },
    transaction,
    include: models.Division.__associations,
    defaults: {
      id: 'state',
      name: 'state',
      title: 'State',
      sort: 'state',
      parent_id: country.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    }
  });
}

// Create state children
function createStateChildren({ db, models, transaction, source, state }) {
  let children = [
    {
      id: 'county',
      name: 'county',
      title: 'County',
      sort: 'county',
      parent_id: state.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'congress',
      name: 'congress',
      title: 'Congressional district',
      sort: 'congressional district',
      parent_id: state.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'state-upper',
      name: 'state-upper',
      title: 'State upper',
      sort: 'state upper',
      parent_id: state.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'state-lower',
      name: 'state-lower',
      title: 'State lower',
      sort: 'state lower',
      parent_id: state.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'water',
      name: 'water',
      title: 'Water district',
      sort: 'water',
      parent_id: state.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'hospital',
      name: 'hospital',
      title: 'Hopsital',
      sort: 'hospital',
      parent_id: state.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'school',
      name: 'school',
      title: 'School',
      sort: 'school',
      parent_id: state.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'park-district',
      name: 'park-district',
      title: 'Park district',
      sort: 'park',
      parent_id: state.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'judicial',
      name: 'judicial',
      title: 'Judicial',
      sort: 'judicial',
      parent_id: state.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    }
  ];

  return Promise.all(
    children.map(c => {
      return db.findOrCreateOne(models.Division, {
        where: { id: c.id },
        include: [{ all: true }],
        transaction,
        defaults: c
      });
    })
  );
}

// Create county children
function createCountyChildren({ db, models, transaction, source, county }) {
  let children = [
    {
      id: 'county-local',
      name: 'county-local',
      title: 'Local',
      sort: 'local county',
      parent_id: county.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'county-commissioner',
      name: 'county-commissioner',
      title: 'County commissioner',
      sort: 'county comissioner',
      parent_id: county.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'county-precinct',
      name: 'county-precinct',
      title: 'Precinct',
      sort: 'precinct county',
      parent_id: county.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    }
  ];

  return Promise.all(
    children.map(c => {
      return db.findOrCreateOne(models.Division, {
        where: { id: c.id },
        include: [{ all: true }],
        transaction,
        defaults: c
      });
    })
  );
}

// Create local children
function createLocalChildren({ db, models, transaction, source, local }) {
  let children = [
    {
      id: 'local-ward',
      name: 'local-ward',
      title: 'Ward',
      sort: 'ward local',
      parent_id: local.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    },
    {
      id: 'local-park-board',
      name: 'local-park-board',
      title: 'Park board',
      sort: 'park board local',
      parent_id: local.get('id'),
      sourceData: {
        [source.get('id')]: { manual: true }
      }
    }
  ];

  return Promise.all(
    children.map(c => {
      return db.findOrCreateOne(models.Division, {
        where: { id: c.id },
        include: [{ all: true }],
        transaction,
        defaults: c
      });
    })
  );
}
