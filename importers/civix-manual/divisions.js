/**
 * Importer for core data: Divisions
 *
 * Divisions describe jurisdiction divisions, such a
 * state.  They are a way to group jurisdiction.
 */

// Dependencies
const { importRecords } = require('../../lib/importing.js');

// Common source information
const source = {
  civix: {
    manual: true
  }
};

// Import function
module.exports = async function coreDataDivisionsImporter({
  logger,
  models,
  db,
  argv
}) {
  logger('info', 'Core data: Divisions importer...');

  // Records to save
  let records = [];

  // Country
  records.push({
    model: models.Division,
    record: {
      id: 'country',
      name: 'country',
      title: 'Country',
      sort: 'country',
      sourceData: source
    }
  });

  // State
  records.push({
    model: models.Division,
    record: {
      id: 'state',
      name: 'state',
      title: 'State',
      sort: 'state',
      parent_id: 'country',
      sourceData: source
    }
  });

  // State children
  [
    {
      id: 'county',
      name: 'county',
      title: 'County',
      sort: 'county',
      parent_id: 'state',
      sourceData: source
    },
    {
      id: 'congress',
      name: 'congress',
      title: 'Congressional district',
      sort: 'congressional district',
      parent_id: 'state',
      sourceData: source
    },
    {
      id: 'state-upper',
      name: 'state-upper',
      title: 'State upper',
      sort: 'state upper',
      parent_id: 'state',
      sourceData: source
    },
    {
      id: 'state-lower',
      name: 'state-lower',
      title: 'State lower',
      sort: 'state lower',
      parent_id: 'state',
      sourceData: source
    },
    {
      id: 'soil-water',
      name: 'soil-water',
      title: 'Soil and water conservation district',
      sort: 'soil water',
      parent_id: 'state',
      sourceData: source
    },
    {
      id: 'hospital',
      name: 'hospital',
      title: 'Hopsital',
      sort: 'hospital',
      parent_id: 'state',
      sourceData: source
    },
    {
      id: 'school',
      name: 'school',
      title: 'School',
      sort: 'school',
      parent_id: 'state',
      sourceData: source
    },
    {
      id: 'park-district',
      name: 'park-district',
      title: 'Park district',
      sort: 'park',
      parent_id: 'state',
      sourceData: source
    },
    {
      id: 'judicial',
      name: 'judicial',
      title: 'Judicial',
      sort: 'judicial',
      parent_id: 'state',
      sourceData: source
    }
  ].forEach(r => {
    records.push({
      model: models.Division,
      record: r
    });
  });

  // County children
  [
    {
      id: 'county-local',
      name: 'county-local',
      title: 'Local',
      sort: 'local county',
      parent_id: 'county',
      sourceData: source
    },
    {
      id: 'county-commissioner',
      name: 'county-commissioner',
      title: 'County commissioner',
      sort: 'county comissioner',
      parent_id: 'county',
      sourceData: source
    },
    {
      id: 'county-precinct',
      name: 'county-precinct',
      title: 'Precinct',
      sort: 'precinct county',
      parent_id: 'county',
      sourceData: source
    }
  ].forEach(r => {
    records.push({
      model: models.Division,
      record: r
    });
  });

  // Local children
  [
    {
      id: 'local-ward',
      name: 'local-ward',
      title: 'Ward',
      sort: 'ward local',
      parent_id: 'county-local',
      sourceData: source
    },
    {
      id: 'local-park-board',
      name: 'local-park-board',
      title: 'Park board',
      sort: 'park board local',
      parent_id: 'county-local',
      sourceData: source
    }
  ].forEach(r => {
    records.push({
      model: models.Division,
      record: r
    });
  });

  // Soil water children
  [
    {
      id: 'soil-water-subdistrict',
      name: 'soil-water-subdistrict',
      title: 'Subdistrict',
      sort: 'soil water subdistrict',
      parent_id: 'soil-water',
      sourceData: source
    }
  ].forEach(r => {
    records.push({
      model: models.Division,
      record: r
    });
  });

  // Import records
  return await importRecords(records, {
    db,
    logger,
    options: argv
  });
};
