# Civix

A set of tools around election results, candidates, districts, and related data. Specifically, `civix` aims to provided:

- A datase model for elections and related data.
- Tools for importing data from multiple sources.
- A simple interface to manage and manually edit data when needed.
- Ability to export data to a static location such as S3.

Inspiration taken from [Politico's civic](https://github.com/The-Politico/politico-civic) suite of tools.

## Getting started

- Setting up the database.
  - This application requires Postgres/PostGIS. It might be possible to use another database with spatial data types, but this has not been tested.
    - TODO: Instructions on setting up Postgres and PostGIS.
    - If using Postgres.app on a Mac, this [gist about setting up PostGIS](https://gist.github.com/joshuapowell/e209a4dac5c8187ea8ce) is helpful, but needs to be adjusted for versions.
  - `npm run migrate`: This will create tables in the database as needed.
    - _TODO_: Migrations not currently implemented.

## Configuration

- `CIVIC_LOGS`: Path to where logs, defaults to `.logs` in the current working directory.
- `CIVIX_DEBUG`: Turn on debugging
- `CIVIX_DATABASE_URI`: Database URI
