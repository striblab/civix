/**
 * Importer for core data: Divisions
 *
 * Divisions describe jurisdiction divisions, such a
 * state.  They are a way to group jurisdiction.
 */

// Dependencies
const _ = require('lodash');

// Dependencies
const { importRecords } = require('../../lib/importing.js');

// Common source information
const source = {
  civix: {
    manual: true,
    fecSource:
      'https://www.fec.gov/campaign-finance-data/party-code-descriptions/',
    apSource:
      'http://customersupport.ap.org/doc/AP_Elections_API_Developer_Guide.pdf'
  }
};

// Import function
module.exports = async function coreDataPartiesImporter({
  logger,
  models,
  db,
  argv
}) {
  logger('info', 'Core data: Party importer...');

  // Inspired by https://www.fec.gov/campaign-finance-data/party-code-descriptions/
  // And http://customersupport.ap.org/doc/AP_Elections_API_Developer_Guide.pdf
  let parties = [
    ['ACE', 'Ace Party'],
    ['AKI', 'Alaskan Independence Party'],
    ['AIC', 'American Independent Conservative'],
    ['AIP', 'American Independent Party'],
    ['AMP', 'American Party', 'AMR'],
    ['APF', 'American People\'s Freedom Party'],
    ['AE', 'Americans Elect', 'AME'],
    ['CIT', 'Citizens\' Party'],
    ['CMD', 'Commandments Party'],
    ['CMP', 'Commonwealth Party of the U.S.'],
    ['COM', 'Communist Party'],
    ['CNC', 'Concerned Citizens Party of Connecticut'],
    ['CRV', 'Conservative Party', 'CON'],
    ['CON', 'Constitution Party', 'CST'],
    ['CST', 'Constitutional'],
    ['COU', 'Country'],
    ['DCG', 'D.C. Statehood Green Party', 'DCG'],
    ['DNL', 'Democratic-Nonpartisan League'],
    ['DEM', 'Democratic Party', 'DEM', 'aaaad'],
    ['D/C', 'Democratic/Conservative'],
    ['DFL', 'Democratic-Farmer-Labor', undefined, 'aaaad', 'DFL'],
    ['DGR', 'Desert Green Party'],
    ['FED', 'Federalist'],
    ['FLP', 'Freedom Labor Party'],
    ['FRE', 'Freedom Party'],
    ['GWP', 'George Wallace Party'],
    ['GRT', 'Grassroots', 'GRP'],
    ['GRE', 'Green Party', 'GRN'],
    ['GR', 'Green-Rainbow'],
    ['HRP', 'Human Rights Party'],
    ['IDP', 'Independence Party', 'INP'],
    ['IND', 'Independent', 'IND'],
    ['IAP', 'Independent American Party', 'IAP'],
    ['ICD', 'Independent Conservative Democratic'],
    ['IGR', 'Independent Green', 'IGR'],
    ['IP', 'Independent Party', 'IP'],
    ['IDE', 'Independent Party of Delaware'],
    ['IPH', 'Independent Party of Hawaii', 'IPH'],
    ['IGD', 'Industrial Government Party'],
    ['JCN', 'Jewish/Christian National'],
    ['JUS', 'Justice Party'],
    ['LRU', 'La Raza Unida'],
    ['LBR', 'Labor Party', 'LAB'],
    ['LFT', 'Less Federal Taxes'],
    ['LBL', 'Liberal Party'],
    ['LIB', 'Libertarian Party', 'LIB'],
    ['LBU', 'Liberty Union Party', 'LUN'],
    ['LMN', 'Legal Marijuana Now', 'LMN'],
    ['MOD', 'Moderate', 'MOD'],
    ['MTP', 'Mountain Party', 'MNT'],
    ['NDP', 'National Democratic Party'],
    ['NLP', 'Natural Law Party', 'NLP'],
    ['NA', 'New Alliance'],
    ['NJC', 'New Jersey Conservative Party'],
    ['NPP', 'New Progressive Party'],
    ['NP', 'No party affiliation', undefined, 'zzza'],
    ['NON', 'Non-party', undefined, 'zzzb'],
    ['OE', 'One Earth Party'],
    ['PG', 'Pacific Green', 'PAG'],
    ['PSL', 'Party for Socialism and Liberation'],
    ['PFP', 'Peace and Freedom Party', 'PFP'],
    ['POP', 'People Over Politics'],
    ['PPY', 'People\'s Party'],
    ['PCH', 'Personal Choice Party'],
    ['PPD', 'Popular Democratic Party'],
    ['PRO', 'Progressive Party', 'PRG'],
    ['NAP', 'Prohibition Party'],
    ['PRI', 'Puerto Rican Independence Party'],
    ['REF', 'Reform Party', 'RP'],
    ['REP', 'Republican Party', 'GOP', 'aaaar'],
    ['RES', 'Resource Party'],
    ['RTL', 'Right to Life'],
    ['SEP', 'Socialist Equality Party'],
    ['SLP', 'Socialist Labor Party'],
    ['SUS', 'Socialist Party'],
    ['SOC', 'Socialist Party U.S.A.'],
    ['SWP', 'Socialist Workers Party'],
    ['TX', 'Taxpayers'],
    ['TWR', 'Taxpayers without Representation'],
    ['TEA', 'Tea Party'],
    ['THD', 'Theo-Democratic'],
    ['USP', 'U.S. People\'s Party'],
    ['UST', 'U.S. Taxpayers Party', 'UST'],
    ['UNA', 'United Nationalist Alliance'],
    ['UC', 'United Citizen', 'UCZ'],
    ['UNI', 'United Party', 'UNI'],
    ['UNK', 'Unknown', undefined, 'zzzm'],
    ['VET', 'Veterans Party'],
    ['WTP', 'We the People'],
    ['WI', 'Write-in', undefined, 'zzzz']
  ];

  // Put together for record
  let records = parties.map(p => {
    let d = {
      id: _.kebabCase(p[0]),
      name: _.kebabCase(p[0]),
      title: p[1].trim(),
      // Short title from p4, or remove party, or
      shortTitle: p[4]
        ? p[4]
        : p[1] && p[1].match(/ party/i)
          ? p[1].replace(/ party$/i, '')
          : undefined,
      abbreviation: p[0],
      // Specific AP ids
      apId: p[2] ? p[2].toLowerCase() : undefined,
      // Sort using p3 or just name
      sort: `${p[3] ? p[3] + ' ' : ''}${_.kebabCase(p[1]).replace(/-/g, ' ')}`,
      sourceData: source
    };

    return {
      model: models.Party,
      record: d
    };
  });

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
