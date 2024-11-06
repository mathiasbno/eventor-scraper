# Eventor Scraper and Dashboard

This project is a web application for scraping data from Eventor and displaying it on a dashboard that can be found at [statistikk.orientering.no](https://statistikk.orientering.no/).

## Setup

### Installation

1. Clone the repository:

```bash
  $ git clone git@github.com:mathiasbno/eventor-scraper.git
  $ cd eventor-scraper

```

2. Install dependencies:

```bash
  $ npm install
```

3. Add env file:
   Add a `.env` file in root and provide the following data:

```.env
EVENTOR_PATH=https://eventor.orientering.no/api/
EVENTOR_APIKEY=<your-api-key>
API_PATH=http://localhost:4000/api
```

This env file represents your local development environment.

## How to Run the React Project

### Development

To run the local development server:

```bash
  $ npm run dev
```

### Production

We use Vercel to host the website. Pushing to master autodeploys to master.

## Database

For simplicities sake we store the data in a postgresql database using the cloud service [Supabase](https://supabase.com/). We dont provide access to the production database, but you can set up a local environment by following the steps below.

### Local development

You can follow the steps in the [Supabase CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started) to get started with your local development with supabse.

The migration files are included to mirror the production environment localy. So after setting up the CLI you can run the following command to configure your databse:

```bash
supabase migration up
```

Seed data for `organisations`, `diciplins` and `clasifications` are provided and will be inserted in your local DB when you run `supabase start`. When developing you can reset your local DB with `supabase db reset`, this will nuke the DB and reseeds it.

## Data Processing

### Fetching Data

Now that your databse is all set up we can fetch data from Eventor you'll need a API key provided from Eventor. You can read more about that here: [https://eventor.orientering.no/Documents/Guide*Eventor*-\_Hamta_data_via_API.pdf](https://eventor.orientering.no/Documents/Guide_Eventor_-_Hamta_data_via_API.pdf)

Eventor API methods: [https://eventor.orientering.no/api/documentation](https://eventor.orientering.no/api/documentation)

To be able to read and write to the database we need to set up some more env variables.
You can find the needed values by running `supabase status` in the CLI.

Add the following lines to your `.env` file:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLIC_ANON_KEY=<your-public-anon-key>
```

To fetch data we first need to run the local server like so:

```bash
  $ npm run server
```

_Make sure to have the right path to the server configured in the `.env` file as specified above_

Edit the `src/process.js` file to configure the timeframe for fetching events like so:

```js
// Get the last 7 days of events
const startDate = new Date("2023-01-01");
const endDate = new Date("2023-12-31");
// (To avoid craches we recomend doing a year at a time when processing)

const granularity = 30; // some times the database times out with larger granularities when there are big races being processed from Eventor
const dryrun = false; // set to true if you just want the fetch data and not insert it into the database

fetchEventsAndInsert(startDate, endDate, granularity, dryrun);
```

_Note that Eventor can be a bit slow during the day when in seasson, so you might experience some timeouts. If you plan to download a lot of data its recomended to do it in the evenings_

Run process to fetch data:

```bash
  $ npm run process
```

After processing we end up with a lot of duplicate runners, to mitegate this we have two functions to process and remove them. This does not cover all cases but gets rid of many with slightly different names due to typos and other smaller mistakes.

Uncomment the following lines and run process again. we add a ayear range to avoid processing to much data.

```js
await mergeDuplicateRunners(1, 2020, 2024);
await mergeDuplicateRunners(2, 2020, 2024);
await removeRunnersWithoutResult();
```

## Contributing

Feel free to open issues or submit pull requests for any improvements or bug fixes.

## License

This project is licensed under the MIT License.
