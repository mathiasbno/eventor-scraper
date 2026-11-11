import { useState } from "react";
import {
  Button,
  Card,
  LineChart,
  Switch,
  Tab,
  TabGroup,
  TabList,
} from "@tremor/react";
import { Spinner } from "../Spinner";
import { COVERAGE, transformData } from "../../helpers/startCountChart";
import { useRunnersByStartCount } from "../../helpers/useRunnersByStartCount";
import {
  CategoryAndYearSelects,
  SamePeriodSwitch,
  samePeriodNote,
  startCountColors,
  startCountLabelClass,
  startCountScopeNote,
} from "./StartCountFilters";

export function RunnersByStartCountChart({ filter }) {
  const [accumulate, setAccumulate] = useState(true);
  const [direction, setDirection] = useState("lte");
  const {
    data,
    loading,
    error,
    fetchData,
    samePeriod,
    setSamePeriod,
    selectedCategories,
    setSelectedCategories,
    selectedYears,
    yearLabels,
    handleYearsChange,
  } = useRunnersByStartCount(filter);

  const chartData = transformData(data, selectedYears, accumulate, direction);

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
          <SamePeriodSwitch
            id="start-count-same-period"
            samePeriod={samePeriod}
            setSamePeriod={setSamePeriod}
          />
          <div className="flex flex-row gap-3 items-center">
            <label
              htmlFor="start-count-accumulate"
              className={startCountLabelClass}
            >
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
              title={accumulate ? undefined : "Slå på «Akkumulert» for å velge"}
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
          <CategoryAndYearSelects
            idPrefix="start-count"
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            selectedYears={selectedYears}
            yearLabels={yearLabels}
            handleYearsChange={handleYearsChange}
          />
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
            categories={selectedYears}
            colors={startCountColors}
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
        <p>{startCountScopeNote}</p>
        <p>{samePeriodNote(samePeriod)}</p>
      </div>
    </Card>
  );
}
