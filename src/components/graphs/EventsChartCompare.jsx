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

import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";
import { transformDataForChart } from "../../helpers/chart";

export function EventsChartCompare(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [accumulate, setAccumulate] = useState(true);
  const [localFilter, setLocalFilter] = useState(["2024", "2019"]);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const { data, error } = await supabase.rpc("get_events_by_granularity", {
        granularity: "month",
        organisation_ids: filter.organisations,
        discipline_list: filter.disciplines,
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
        setLoading(false);
      }
    };

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
        {!loading ? (
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
        ) : (
          <Spinner />
        )}
      </div>
    </Card>
  );
}
