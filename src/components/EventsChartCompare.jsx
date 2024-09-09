import {
  Card,
  LineChart,
  MultiSelect,
  MultiSelectItem,
  Select,
  SelectItem,
  Switch,
} from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../supabaseClient";
import { Spinner } from "./Spinner";
import { transformDataForChart } from "../helpers/chart";

export function EventsChartCompare() {
  const [data, setData] = useState([]);
  const [accumulate, setAccumulate] = useState(true);
  const [filter, setFilter] = useState(["2024", "2019"]);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.rpc("get_events_by_granularity", {
        granularity: "month",
      });

      if (error) {
        console.error("Error fetching data:", error);
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
      }
    };

    fetchData();
  }, []);

  const chartData = transformDataForChart(
    data,
    "total_starts",
    filter,
    accumulate
  );

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-4"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Sammenlign starter pr år
        </h3>

        <div className="flex justify-between items-center gap-3">
          <label
            htmlFor="switch"
            className="text-tremor-default text-tremor-content dark:text-dark-tremor-content"
          >
            Sum
          </label>
          <Switch
            id="switch"
            name="switch"
            checked={accumulate}
            onChange={setAccumulate}
          />

          <MultiSelect
            className="w-64"
            defaultValue={["2024", "2019"]}
            onValueChange={(e) => setFilter(e)}
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

      {chartData.length ? (
        <LineChart
          className="h-80"
          data={chartData}
          index="period"
          categories={filter}
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
      ) : (
        <Spinner />
      )}
    </Card>
  );
}
