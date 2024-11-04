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

## Database

For simplicities sake we store the data in a postgresql database using the cloud service (Supabase)[https://supabase.com/]. To be able to store the data to the production database you'll have to get the correct env variables from me.

Information about migration and local development is under construction.

You can follow the steps in the (Supabase CLI setup)[https://supabase.com/docs/guides/local-development/cli/getting-started] to get started with your local development with supabse.

The migration files are included to mirror the environment localy. So after setting up the CLI you can run the following command to configure your databse:

```bash
supabase migration up
```

## Contributing

Feel free to open issues or submit pull requests for any improvements or bug fixes.

## License

This project is licensed under the MIT License.
