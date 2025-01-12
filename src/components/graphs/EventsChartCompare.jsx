import {
  Button,
  Card,
  LineChart,
  MultiSelect,
  MultiSelectItem,
  Switch,
} from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";
import { transformDataForChart } from "../../helpers/chart";

export function EventsChartCompare(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [accumulate, setAccumulate] = useState(true);
  const [error, setError] = useState(null);
  const [localFilter, setLocalFilter] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_events_starts", {
      granularity: "month",
      organisation_ids: filter.organisations,
      discipline_list: filter.disciplines,
    });

    if (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      setLoading(false);
    } else {
      const groupedData = data.reduce((acc, item) => {
        const year = new Date(item.period).getFullYear();
        if (!acc[year]) {
          acc[year] = [];
        }
        acc[year].push(item);
        return acc;
      }, {});
      setData(groupedData);
      const availableYears = Object.keys(groupedData).sort((a, b) => b - a);
      setLocalFilter(availableYears);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const chartData = transformDataForChart(
    data,
    "total_starts",
    localFilter,
    accumulate
  );

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-4"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start md:items-center md:flex-row flex-col mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Starter pr år
        </h3>

        <div className="flex md:flex-row flex-col items-start justify-between md:items-center gap-3">
          <div className="flex flex-row gap-3">
            <label
              htmlFor="switch"
              className="text-tremor-default text-tremor-content dark:text-dark-tremor-content"
            >
              Akkumulert pr år
            </label>
            <Switch
              id="switch"
              name="switch"
              checked={accumulate}
              onChange={setAccumulate}
            />
          </div>

          <MultiSelect
            className="w-64"
            value={localFilter}
            onValueChange={(e) => setLocalFilter(e)}
          >
            {Object.keys(data)
              .sort((a, b) => b - a)
              .map((year) => (
                <MultiSelectItem value={year} key={`year-${year}`}>
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
            colors={[
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
            ]}
            yAxisWidth={60}
            onValueChange={(v) => console.log(v)}
          />
        )}
      </div>
      <p className="text-tremor-content text-xs dark:text-dark-tremor-content mt-5">
        Data for inneværende år viser tall til og med sist uke.
      </p>
    </Card>
  );
}
