# Eventor Scraper and Dashboard

This project is a web application for scraping data from Eventor and displaying it on a dashboard.

## Setup

### Installation

1. Clone the repository:

   ```bash
   git clone git@github.com:mathiasbno/eventor-scraper.git
   cd eventor-scraper

   ```

2. Install dependencies:

```bash
  npm install
```

3. Add env file:
   Add a `.env` file in root and provide the following data:

```.env
EVENTOR_PATH=https://eventor.orientering.no/api/
EVENTOR_APIKEY=<your-api-key>
API_PATH=http://localhost:4000/api
SUPABASE_USER=<your-username>
SUPABASE_PASSWORD=<your-password>
```

## How to Run the React Project

### Development

To run the local development server:

```bash
  npm run dev
```

### Production

We use Vercel to host the website. Pushing to master autodeploys to master.

## Data Processing

### Fetching Data

To fetch data from Eventor you'll need a API key provided from Eventor. You can read more about that here: [https://eventor.orientering.no/Documents/Guide*Eventor*-\_Hamta_data_via_API.pdf](https://eventor.orientering.no/Documents/Guide_Eventor_-_Hamta_data_via_API.pdf)

Eventor API methods: [https://eventor.orientering.no/api/documentation](https://eventor.orientering.no/api/documentation)

To fetch data we first need to run the local server like so:

```bash
  npm run server
```

_Make sure to have the right path to the server configured in the `.env` file as specified above_

Edit the `src/process.js` file to configure the timeframe for fetching events like so:

```js
// Get the last 7 days of events
const startDate = new Date().setDate(new Date().getDate() - 7);
const endDate = new Date();

const granularity = 10; // some times the database times out with larger granularities when there are big races being processed from Eventor
const dryrun = false; // set to true if you just want the fetch data and not insert it into the database

fetchEventsAndInsert(startDate, endDate, granularity, dryrun);
```

Run process to fetch data:

```bash
  npm run process
```

For simplicities sake we store the data in a postgresql database using the cloud service (Supabase)[https://supabase.com/]. To be able to store the data to the production database you'll have to get the correct env variables from me.

If you whish to experiment for yourself on the side you can recreate the database in Supabase for yourself using the following commands. _(This might change over time as development moves forward)_

```sql
  CREATE TABLE classes (id bigint  NOT NULL PRIMARY KEY, created_at timestamp with time zone now() NOT NULL , classId text  NULL , eventId text  NULL , name text  NULL , shortName text  NULL , lowAge smallint  NULL , highAge smallint  NULL , sex character varying  NULL , type text  NULL );

  CREATE TABLE classifications (id bigint  NOT NULL PRIMARY KEY, classificationId text  NULL , classificationName text  NULL );

  CREATE TABLE discipline (id bigint  NOT NULL PRIMARY KEY, disciplineId text  NULL , name text  NULL );

  CREATE TABLE entries (id bigint  NOT NULL PRIMARY KEY, classId text  NULL , eventId text  NULL , personId text  NULL , date date  NULL , entryId text  NULL );

  CREATE TABLE entryfees (id bigint  NOT NULL PRIMARY KEY, created_at timestamp with time zone now() NOT NULL , eventId text  NULL , entryFeeId text  NOT NULL , name text  NULL , amount smallint  NULL , type text  NULL , valueOperator text  NULL , order text  NULL , classType text  NULL );

  CREATE TABLE events (id bigint  NOT NULL PRIMARY KEY, created_at timestamp with time zone now() NOT NULL , eventId text  NULL , name text  NULL , disciplineId text  NULL , classificationId text  NULL , distance text  NULL , lightConditions text  NULL , numberOfEntries smallint  NULL , numberOfStarts smallint  NULL , startDate date  NULL , location json  NULL , punchingUnitType text  NULL , organiserId text[]  NULL );

  CREATE TABLE organisations (id bigint  NOT NULL PRIMARY KEY, created_at timestamp with time zone now() NOT NULL , organisationId text  NULL , name text  NULL , countryName text  NULL , parentOrganisationId text  NULL , type text  NULL );

  CREATE TABLE results (id bigint  NOT NULL PRIMARY KEY, classId text  NULL , eventId text  NULL , personId text  NULL , name text  NULL , date date  NULL , resultId text  NULL );

  CREATE TABLE runners (id bigint  NOT NULL PRIMARY KEY, personId text  NULL , gender text  NULL , fullName text  NULL , birthDate date  NULL , nationality text  NULL , organisationId text  NULL );
```

You'll also need to add the following configs to the `.env` file.

```.env
SUPABASE_URL<path-to-supabase-database>
SUPABASE_PUBLIC_ANON_KEY=<your-supabase-anon-key
```

## Contributing

Feel free to open issues or submit pull requests for any improvements or bug fixes.

## License

This project is licensed under the MIT License.
