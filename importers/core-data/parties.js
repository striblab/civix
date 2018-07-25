/**
 * Importer for core data: Divisions
 *
 * Divisions describe jurisdiction divisions, such a
 * state.  They are a way to group jurisdiction.
 */

// Dependencies
const _ = require('lodash');
const ensureManualSource = require('./manual-source.js');

// Import function
module.exports = async function coreDataDivisionsImporter({
  logger,
  models,
  db
}) {
  logger('info', 'Core data: Party importer...');
  let updates = [];

  // Wrap in transaction
  return db.sequelize
    .transaction({}, t => {
      // Start promise chain
      return ensureManualSource({ models, transaction: t }).then(source => {
        updates = updates.concat([source]);

        // Related model includes
        const include = [
          {
            model: models.SourceData,
            as: 'source_data',
            include: {
              model: models.Source
            }
          }
        ];

        // Inspired by https://www.fec.gov/campaign-finance-data/party-code-descriptions/
        let parties = [
          ['ACE', 'Ace Party'],
          ['AKI', 'Alaskan Independence Party'],
          ['AIC', 'American Independent Conservative'],
          ['AIP', 'American Independent Party'],
          ['AMP', 'American Party'],
          ['APF', 'American People\'s Freedom Party'],
          ['AE', 'Americans Elect'],
          ['CIT', 'Citizens\' Party'],
          ['CMD', 'Commandments Party'],
          ['CMP', 'Commonwealth Party of the U.S.'],
          ['COM', 'Communist Party'],
          ['CNC', 'Concerned Citizens Party of Connecticut'],
          ['CRV', 'Conservative Party'],
          ['CON', 'Constitution Party'],
          ['CST', 'Constitutional'],
          ['COU', 'Country'],
          ['DCG', 'D.C. Statehood Green Party'],
          ['DNL', 'Democratic-Nonpartisan League'],
          ['DEM', 'Democratic Party'],
          ['D/C', 'Democratic/Conservative'],
          ['DFL', 'Democratic-Farmer-Labor'],
          ['DGR', 'Desert Green Party'],
          ['FED', 'Federalist'],
          ['FLP', 'Freedom Labor Party'],
          ['FRE', 'Freedom Party'],
          ['GWP', 'George Wallace Party'],
          ['GRT', 'Grassroots'],
          ['GRE', 'Green Party'],
          ['GR', 'Green-Rainbow'],
          ['HRP', 'Human Rights Party'],
          ['IDP', 'Independence Party'],
          ['IND', 'Independent'],
          ['IAP', 'Independent American Party'],
          ['ICD', 'Independent Conservative Democratic'],
          ['IGR', 'Independent Green'],
          ['IP', 'Independent Party'],
          ['IDE', 'Independent Party of Delaware'],
          ['IGD', 'Industrial Government Party'],
          ['JCN', 'Jewish/Christian National'],
          ['JUS', 'Justice Party'],
          ['LRU', 'La Raza Unida'],
          ['LBR', 'Labor Party'],
          ['LFT', 'Less Federal Taxes'],
          ['LBL', 'Liberal Party'],
          ['LIB', 'Libertarian Party'],
          ['LBU', 'Liberty Union Party'],
          ['MTP', 'Mountain Party'],
          ['NDP', 'National Democratic Party'],
          ['NLP', 'Natural Law Party'],
          ['NA', 'New Alliance'],
          ['NJC', 'New Jersey Conservative Party'],
          ['NPP', 'New Progressive Party'],
          ['NP', 'No party affiliation', 'zzza'],
          ['NON', 'Non-party', 'zzzb'],
          ['OE', 'One Earth Party'],
          ['PG', 'Pacific Green'],
          ['PSL', 'Party for Socialism and Liberation'],
          ['PFP', 'Peace and Freedom Party'],
          ['POP', 'People Over Politics'],
          ['PPY', 'People\'s Party'],
          ['PCH', 'Personal Choice Party'],
          ['PPD', 'Popular Democratic Party'],
          ['PRO', 'Progressive Party'],
          ['NAP', 'Prohibition Party'],
          ['PRI', 'Puerto Rican Independence Party'],
          ['REF', 'Reform Party'],
          ['REP', 'Republican Party'],
          ['RES', 'Resource Party'],
          ['RTL', 'Right to Life'],
          ['SEP', 'Socialist Equality Party'],
          ['SLP', 'Socialist Labor Party'],
          ['SUS', 'Socialist Party'],
          ['SOC', 'Socialist Party U.S.A.'],
          ['SWP', 'Socialist Workers Party'],
          ['TX', 'Taxpayers'],
          ['TWR', 'Taxpayers without Representation '],
          ['TEA', 'Tea Party'],
          ['THD', 'Theo-Democratic'],
          ['USP', 'U.S. People\'s Party'],
          ['UST', 'U.S. Taxpayers Party'],
          ['UC', 'United Citizen'],
          ['UNI', 'United Party'],
          ['UNK', 'Unknown', 'zzzm'],
          ['VET', 'Veterans Party'],
          ['WTP', 'We the People'],
          ['WI', 'Write-in', 'zzzz']
        ];

        return Promise.all(
          parties.map(p => {
            let d = {
              id: _.kebabCase(p[0]),
              name: _.kebabCase(p[0]),
              title: p[1].trim(),
              abbreviation: p[0],
              sort: `${p[2] ? p[2] + ' ' : ''}${_
                .kebabCase(p[1])
                .replace(/-/g, ' ')}`,
              source_data: [
                {
                  id: `core-data-division-parties-${_.kebabCase(p[0])}`,
                  sourceIdentifier: p[0],
                  data: {
                    manual: true,
                    inspiration:
                      'https://www.fec.gov/campaign-finance-data/party-code-descriptions/'
                  },
                  source_id: source[0].dataValues.id
                }
              ]
            };

            return models.Party.findOrCreate({
              where: { id: d.id },
              transaction: t,
              include,
              defaults: d
            });
          })
        ).then(results => {
          updates = updates.concat(results);
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
