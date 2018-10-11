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
- `CIVIX_ELEX_TEST`: Whether to use test data from AP via Elex.

### Setting up the database.

- This application requires Postgres/PostGIS. It might be possible to use another database with spatial data types, but this has not been tested.
  - TODO: Instructions on setting up Postgres and PostGIS.
  - If using Postgres.app on a Mac, this [gist about setting up PostGIS](https://gist.github.com/joshuapowell/e209a4dac5c8187ea8ce) is helpful, but needs to be adjusted for versions.
- `civix migrate`: This will create tables in the database as needed.
  - _TODO_: Specific migrations not currently implemented.

## Usage

### Base data

Getting data is done with the `civix import` command.

- Manually created core data:
  - Political parties: `civix import civix-manual/parties`
  - Boundary divisions: `civix import civix-manual/divisions`
- Boundaries:
  - Country boundaries, including USA: `civix import natural-earth/boundaries-countries`
  - US state boundaries: `civix import census-tiger/boundaries-states`
  - US county boundaries: `civix import census-tiger/boundaries-counties --year=XXX`
    - Year options: `2017`
  - US congressional boundaries: `civix import census-tiger/boundaries-congressional --congress=XXX`
    - Congress option can be `110` - `115`
    - This may not be perfect, since these boundaries change at any time.
  - MN state house: `civix import mn-state-leg/boundaries-state-house --year=XXX`
    - Year options: `1994`, `2002`, `2012`
  - MN state senate: `civix import mn-state-leg/boundaries-state-senate --year=XXX`
    - Year options: `1994`, `2002`, `2012`
  - MN state municipal (cities and townships): `civix import mn-state-leg/boundaries-municipal --year=XXX`
    - Year options: `2014`, `2016`, `2018`
  - MN state precincts: `civix import mn-state-leg/boundaries-precincts --year=XXX`
    - Year options: `2012`, `2014`, `2016`, `2018`

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

## Data structure and models.

All about the data structure and database schema. See files in `./models/` for more technical information about the database models.

- _Boundaries_: Boundary models describe geographical areas for offices and elections.
  - A **Boundary** entry describes an area, and connects it to a _Division_ and possible a parent _Boundary_.
    - For example, the state of Minnesota is a boundary.
  - A **Boundary Version** describes the actual geographical shape of a boundary for a specific period in time. This entry also may include census fields such as _FIPS_, _GEOID_, or _AFFGEOID_.
    - For example, Minnesota Congressional District 2 is a boundary, but the specific shape of it as defined by the 2010 Census and started being used in 2012 is the specific boundary version.
  - A **Division** describes groups and heirarchy of boundaries.
    - For example, a state is a division, and a county is a divison that is a child of a state.
- _Government_: Government models describes offices and bodies that have elected officials.
  - **Body**: A collection of related offices such as a state senate.
    - For example, the Minnesota State House
  - **Office**: A position that is filled by an elected official.
    - For example, the office of Minnesota's Congressional District 5
  - **Party**: A political party.
    - For example, the Republican party.
- _Elections_: Election models bring together _Boundaries_ and _Government_ to describe election results.
  - **Election**: An election on a date in a place. Usually the place is a state.
    - For example, 2018 General Election in Minnesota.
  - **Candidate**: A single person, answer, or position that is an option for a specific contest.
    - For example, Jane Doe, or Yes, or write-in's.
  - **Contest**: A contest in an Election. This is often tied to an Office, except for questions/ballot measures. It should, though not needed, be tied to a Boundary Version. A Contest can also be a "sub-contest"; for example the results for a contest for each county in a state.
    - For example, 2018 election for Hennepin County Commissioner 3.
    - A sub contest may be precinct results for that contest.
  - **Result**: The numbers for a Candidate in a Contest.
    - For example, Muhammad Doe got 123 votes.
