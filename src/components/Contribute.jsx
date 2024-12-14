import { Card } from "@tremor/react";

export function Contribute() {
  return (
    <Card className="col-span-4 bg-red-100 dark:bg-red-950">
      <div className="flex flex-col gap-2">
        <h3 className="text-rose-600 font-medium text-rose-600">
          Ønsker du å bidra?
        </h3>
        <p className="text-rose-600 text-xs ">
          Dette prosjektet er open source, du finner kildekoden på Github:{" "}
          <a
            href="https://github.com/mathiasbno/eventor-scraper"
            target="_blank"
            rel="noreferrer"
            className="text-tremor-content-strong hover:underline-offset-1 hover:underline dark:text-rose-600"
          >
            https://github.com/mathiasbno/eventor-scraper
          </a>
        </p>
        <p className="text-rose-600 text-xs ">
          Har du funnet en feil eller har forslag til forbedringer? Opprett et
          issue på Github eller åpne en pullrequest.
        </p>
      </div>
    </Card>
  );
}
