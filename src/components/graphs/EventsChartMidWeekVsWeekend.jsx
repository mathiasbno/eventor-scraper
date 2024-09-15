import {
  Card,
  LineChart,
  MultiSelect,
  MultiSelectItem,
  Select,
  SelectItem,
} from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";

import {
  getUniqueYears,
  granularityLookup,
  groupDataByGranularity,
} from "../../helpers/chart";

export function EventsChartMidWeekVsWeekend(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [granularity, setGranularity] = useState("week");
  const [localFilter, setLocalFilter] = useState(["2024", "2019"]);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const { data, error } = await supabase.rpc(
        "get_mid_week_and_weekend_starts",
        {
          granularity,
          organisation_ids: filter.organisations,
        }
      );

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setData(data);
        setLoading(false);
      }
    };

    fetchData();
  }, [granularity, filter]);

  // Transform the data to group by year
  const chartData = groupDataByGranularity(data, granularity);
  const years = getUniqueYears(data);

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-4"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start md:items-center md:flex-row flex-col mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium ">
          Midt-uke vs helgestarter pr {granularityLookup[granularity]}
        </h3>
        <p className="text-tremor-content dark:text-dark-tremor-content mb-2">
          Midt-uke = mandag til torsdag, helg = fredag til søndag.
        </p>

        <div className="flex md:flex-row flex-col justify-between items-center gap-3">
          {/* <Select
            className="w-64"
            defaultValue="number_of_events"
            onValueChange={(value) => setDataPoint(value)}
          >
            <SelectItem value="number_of_events">Antal løp</SelectItem>
            <SelectItem value="total_starts">Starter</SelectItem>
          </Select> */}
          <Select
            className="w-64"
            defaultValue="week"
            onValueChange={(value) => setGranularity(value)}
          >
            <SelectItem value="week">Uke</SelectItem>
            <SelectItem value="month">Måned</SelectItem>
          </Select>

          <MultiSelect
            className="w-64"
            defaultValue={["2024", "2019"]}
            onValueChange={(e) => setLocalFilter(e)}
          >
            {years
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
            categories={localFilter
              .map((year) => [`Midt-uke-${year}`, `Helg-${year}`])
              .flat()}
            colors={["teal", "yellow", "fuchsia", "lime"]}
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
