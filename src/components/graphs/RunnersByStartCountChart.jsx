import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  LineChart,
  MultiSelect,
  MultiSelectItem,
  Switch,
  Tab,
  TabGroup,
  TabList,
} from "@tremor/react";
import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";
import {
  COVERAGE,
  groupByYear,
  transformData,
} from "../../helpers/startCountChart";

// Event classifications imported by the scraper (classificationId -> label).
const categories = [
  { id: "0", label: "Internasjonale løp" },
  { id: "1", label: "Mesterskap" },
  { id: "2", label: "Nasjonale løp" },
  { id: "3", label: "Kretsløp" },
  { id: "4", label: "Nærløp" },
];

const colors = [
  "fuchsia",
  "lime",
  "teal",
  "yellow",
  "indigo",
  "rose",
  "cyan",
  "amber",
  "emerald",
  "orange",
  "violet",
  "sky",
  "stone",
  "pink",
];

export function RunnersByStartCountChart({ filter }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [error, setError] = useState(null);
  const [accumulate, setAccumulate] = useState(true);
  const [direction, setDirection] = useState("lte");
  const [samePeriod, setSamePeriod] = useState(true);
  const [localFilter, setLocalFilter] = useState([]);
  // Empty means all categories.
  const [selectedCategories, setSelectedCategories] = useState([]);
  const lastFilter = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data: rows, error } = await supabase.rpc(
      "get_runners_by_start_count",
      {
        organisation_ids: filter.organisations,
        discipline_list: filter.disciplines,
        same_period: samePeriod,
        classification_list: selectedCategories.length
          ? selectedCategories.map(Number)
          : null,
      }
    );

    if (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
    } else {
      const grouped = groupByYear(rows);
      setData(grouped);
      // Only reset the selected years when the page filter changes, not when
      // toggling "Samme periode".
      if (lastFilter.current !== filter) {
        lastFilter.current = filter;
        setLocalFilter(Object.keys(grouped).sort((a, b) => b - a).slice(0, 3));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filter, samePeriod, selectedCategories]);

  const chartYearLabels = Object.keys(data).sort((a, b) => b - a);
  const chartData = transformData(data, localFilter, accumulate, direction);

  const handleSelectChange = (selectedValues) => {
    setLocalFilter(
      selectedValues
        .filter((year) => chartYearLabels.includes(year))
        .sort((a, b) => b - a)
    );
  };

  const labelClass =
    "text-tremor-default text-tremor-content dark:text-dark-tremor-content";

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-4"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start lg:items-center lg:flex-row flex-col mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Løpere etter antall starter
        </h3>
        <div className="flex md:flex-row flex-col items-start justify-between md:items-center gap-3 flex-wrap">
          <div className="flex flex-row gap-3 items-center">
            <label htmlFor="start-count-same-period" className={labelClass}>
              Samme periode
            </label>
            <Switch
              id="start-count-same-period"
              name="start-count-same-period"
              checked={samePeriod}
              onChange={setSamePeriod}
            />
          </div>
          <div className="flex flex-row gap-3 items-center">
            <label htmlFor="start-count-accumulate" className={labelClass}>
              Akkumulert
            </label>
            <Switch
              id="start-count-accumulate"
              name="start-count-accumulate"
              checked={accumulate}
              onChange={setAccumulate}
            />
          </div>
          <TabGroup
            index={direction === "lte" ? 0 : 1}
            onIndexChange={(i) => setDirection(i === 0 ? "lte" : "gte")}
            className="w-auto"
          >
            {/* Tremor's Tab has no disabled styling, so dim it ourselves. */}
            <TabList
              variant="solid"
              aria-disabled={!accumulate}
              title={
                accumulate ? undefined : "Slå på «Akkumulert» for å velge"
              }
              className={accumulate ? "" : "opacity-50 cursor-not-allowed"}
            >
              <Tab
                disabled={!accumulate}
                className={accumulate ? "" : "cursor-not-allowed"}
              >
                ≤ Maks
              </Tab>
              <Tab
                disabled={!accumulate}
                className={accumulate ? "" : "cursor-not-allowed"}
              >
                ≥ Minst
              </Tab>
            </TabList>
          </TabGroup>
          <MultiSelect
            className="w-64"
            placeholder="Alle kategorier"
            placeholderSearch="Søk"
            value={selectedCategories}
            onValueChange={setSelectedCategories}
          >
            {categories.map(({ id, label }) => (
              <MultiSelectItem value={id} key={`start-count-category-${id}`}>
                {label}
              </MultiSelectItem>
            ))}
          </MultiSelect>
          <MultiSelect
            className="w-64"
            value={localFilter}
            onValueChange={handleSelectChange}
          >
            {chartYearLabels.map((year) => (
              <MultiSelectItem value={year} key={`start-count-year-${year}`}>
                {year}
              </MultiSelectItem>
            ))}
          </MultiSelect>
        </div>
      </div>
      <div className="flex justify-center items-center h-80">
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="flex flex-col items-center">
            <Button onClick={fetchData} className="mt-2">
              Last inn på nytt
            </Button>
          </div>
        ) : (
          <LineChart
            className="h-80"
            data={chartData}
            index="period"
            categories={localFilter}
            colors={colors}
            yAxisWidth={60}
            valueFormatter={(v) => `${v.toLocaleString("nb-NO")} løpere`}
          />
        )}
      </div>
      <div className="text-tremor-content text-xs dark:text-dark-tremor-content mt-5 space-y-1">
        <p>
          X-aksen viser antall starter i løpet av året, og går opp til antallet
          som dekker {Math.round(COVERAGE * 100)} % av løperne.{" "}
          {accumulate
            ? direction === "lte"
              ? "«≤ 5» betyr løpere med 5 eller færre starter. Siste punkt, «Alle», er alle løperne."
              : "«≥ 5» betyr løpere med 5 eller flere starter. Siste punkt er de resterende løperne med flest starter."
            : "Viser løpere med nøyaktig så mange starter. Siste punkt samler de resterende løperne med flest starter."}
        </p>
        <p>
          Løpere uten Eventor-ID (f.eks. uregistrerte løpere) er ikke med. Ved
          valg av krets telles løpere fra klubber i kretsen, basert på løperens
          nåværende klubb, med alle deres starter uansett arrangør. Ved valg av kategori telles
          bare starter i løp av de valgte kategoriene.
        </p>
        <p>
          {samePeriod
            ? "«Samme periode» teller kun starter fram til dagens dato i hvert år, slik at inneværende år kan sammenlignes med tidligere år."
            : "Data for inneværende år viser tall til og med sist uke."}
        </p>
      </div>
    </Card>
  );
}
