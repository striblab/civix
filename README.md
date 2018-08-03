# Civix

A set of tools around election results, candidates, districts, and related data. Specifically, `civix` aims to provided:

- A datase model for elections and related data.
- Tools for importing data from multiple sources.
- A simple interface to manage and manually edit data when needed.
- Ability to export data to a static location such as S3.

Inspiration taken from [Politico's civic](https://github.com/The-Politico/politico-civic) suite of tools.

## Getting started

### Install

The long term goal is: `npm install civix -g`

In the meantime, clone the project and do: `npm install && npm link`

### Configuration

- `CIVIC_LOGS`: Path to where logs, defaults to `.logs` in the current working directory.
- `CIVIX_DEBUG`: Turn on debugging
  - `DEBUG=civix:*`: Specific debugging
- `CIVIX_DATABASE_URI`: Database URI
- `AP_API_KEY`: Used by Elex to get AP data

### Setting up the database.

- This application requires Postgres/PostGIS. It might be possible to use another database with spatial data types, but this has not been tested.
  - TODO: Instructions on setting up Postgres and PostGIS.
  - If using Postgres.app on a Mac, this [gist about setting up PostGIS](https://gist.github.com/joshuapowell/e209a4dac5c8187ea8ce) is helpful, but needs to be adjusted for versions.
- `civix migrate`: This will create tables in the database as needed.
  - _TODO_: Specific migrations not currently implemented.

## Usage

### Base data

Getting data is done with the `civix import` command.

- Core data can be created/imported into the database with the following. Order matters.
  - Political parties: `civix import core-data/parties`
  - Boundary divisions: `civix import core-data/divisions`
- Boundaries
  - USA boundary: `civix import core-data/boundaries-country`
  - US state boundaries: `civix import census-tiger/boundaries-states`
  - MN boundaries: `civix import mn-boundaries/boundaries-counties`

_TODO more_

### Election night data

- AP data via the [Elex](https://github.com/newsdev/elex)
  - Get races/contests: `civix ap-elex/ap-races`
  - Get candidates: `civix ap-elex/ap-candidates`
  - Get results: `civix ap-elex/ap-results`

### Export data

Exporting means exporting data from the database to JSON files in your local filesystem. This is done with `civix export`.

- Contests and groups of contests: `civix export core/contests`

### Publish data

To publish the exported flat files to S3, use `civix publish`
