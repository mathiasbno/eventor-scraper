import { Card, LineChart, Select, SelectItem } from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../supabaseClient";
import { Spinner } from "./Spinner";

export function EventsChart() {
  const [data, setData] = useState([]);
  const [granularity, setGranularity] = useState("month");

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.rpc("get_events_by_granularity", {
        granularity,
      });

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setData(data);
      }
    };

    fetchData();
  }, [granularity]);

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-2"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex flex-col justify-between mb-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-2">
          Påmeldinger og starter pr {granularity}
        </h3>

        <Select
          className="w-64"
          defaultValue="month"
          onValueChange={(value) => setGranularity(value)}
        >
          <SelectItem value="month">Måned</SelectItem>
          <SelectItem value="year">År</SelectItem>
        </Select>
      </div>

      {data.length ? (
        <LineChart
          className="h-80"
          data={data}
          index="period"
          categories={["total_entries", "total_starts"]}
          colors={["indigo", "rose"]}
          yAxisWidth={60}
          onValueChange={(v) => console.log(v)}
        />
      ) : (
        <Spinner />
      )}
    </Card>
  );
}
