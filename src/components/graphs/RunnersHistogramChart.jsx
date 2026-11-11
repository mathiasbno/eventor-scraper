import { useState } from "react";
import { BarChart, Button, Card, Switch } from "@tremor/react";
import { Spinner } from "../Spinner";
import { transformHistogramData } from "../../helpers/startCountChart";
import { useRunnersByStartCount } from "../../helpers/useRunnersByStartCount";
import {
  CategoryAndYearSelects,
  SamePeriodSwitch,
  samePeriodNote,
  startCountColors,
  startCountLabelClass,
  startCountScopeNote,
} from "./StartCountFilters";

const formatNumber = (v, digits = 0) =>
  v.toLocaleString("nb-NO", { maximumFractionDigits: digits });

export function RunnersHistogramChart({ filter }) {
  const [asShare, setAsShare] = useState(false);
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

  const chartData = transformHistogramData(data, selectedYears, asShare);
  const valueFormatter = asShare
    ? (v) => `${formatNumber(v, 1)} %`
    : (v) => formatNumber(v);

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-4"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start lg:items-center lg:flex-row flex-col mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Fordeling av løpere etter antall starter
        </h3>
        <div className="flex md:flex-row flex-col items-start justify-between md:items-center gap-3 flex-wrap">
          <SamePeriodSwitch
            id="histogram-same-period"
            samePeriod={samePeriod}
            setSamePeriod={setSamePeriod}
          />
          <div className="flex flex-row gap-3 items-center">
            <label htmlFor="histogram-share" className={startCountLabelClass}>
              Vis som andel (%)
            </label>
            <Switch
              id="histogram-share"
              name="histogram-share"
              checked={asShare}
              onChange={setAsShare}
            />
          </div>
          <CategoryAndYearSelects
            idPrefix="histogram"
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
          <BarChart
            className="h-80"
            data={chartData}
            index="period"
            categories={selectedYears}
            colors={startCountColors}
            valueFormatter={valueFormatter}
            yAxisWidth={asShare ? 64 : 60}
            allowDecimals={false}
            noDataText="Ingen data"
          />
        )}
      </div>
      <div className="text-tremor-content text-xs dark:text-dark-tremor-content mt-5 space-y-1">
        <p>
          Hver søyle viser{" "}
          {asShare ? "andelen av årets løpere" : "antall løpere"} med akkurat så
          mange starter i løpet av året. Søylene samler flere starttall (f.eks.
          «4-6»), så de brede søylene rommer flere starttall enn de smale.
        </p>
        <p>{startCountScopeNote}</p>
        <p>{samePeriodNote(samePeriod)}</p>
      </div>
    </Card>
  );
}
