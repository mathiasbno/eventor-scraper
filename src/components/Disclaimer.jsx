import { Card } from "@tremor/react";

export function Disclaimer() {
  return (
    <Card className="col-span-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Om dataene
        </h3>
        <p className="text-tremor-content text-xs dark:text-dark-tremor-content">
          Dataene er hentet gjennom APIet til Eventor, Norsk Orienterings
          terminliste.
        </p>
        <p className="text-tremor-content text-xs dark:text-dark-tremor-content">
          Alle data baserer seg på resultater, da dette er de sikreste dataene
          vi får fra Eventor.
        </p>
        <p className="text-tremor-content text-xs dark:text-dark-tremor-content">
          Dataene er ment som en indikasjon på utviklingen i Norsk Orientering
          over tid.
        </p>
        <p className="text-tremor-content text-xs dark:text-dark-tremor-content">
          Feil og mangler ved dataene kan forekomme og proseseringen av dataene
          kan endre seg.
        </p>
      </div>
    </Card>
  );
}
