import { Card } from "@tremor/react";

export function Contribute() {
  return (
    <Card className="col-span-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Ønsker du å bidra?
        </h3>
        <p className="text-tremor-content text-xs dark:text-dark-tremor-content">
          Dette prosjektet er open source, du finner kildekoden på Github:{" "}
          <a
            href="https://github.com/mathiasbno/eventor-scraper"
            target="_blank"
            rel="noreferrer"
            className="text-tremor-content-strong dark:text-dark-tremor-content-strong underline-offset-auto"
          >
            https://github.com/mathiasbno/eventor-scraper
          </a>
        </p>
        <p className="text-tremor-content text-xs dark:text-dark-tremor-content">
          Har du funnet en feil eller har forslag til forbedringer? Opprett et
          issue på Github eller åpne en pullrequest.
        </p>
      </div>
    </Card>
  );
}
