import { Card, LineChart, Select, SelectItem } from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../supabaseClient";
import { Spinner } from "./Spinner";

export function EventsCategoryChart() {
  const [data, setData] = useState([]);
  const [granularity, setGranularity] = useState("month");
  const [dataPoint, setDataPoint] = useState("number_of_events");

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.rpc(
        "get_events_by_classification_granularity",
        {
          granularity,
        }
      );

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setData(data);
      }
    };

    fetchData();
  }, [granularity]);

  const chartData = data.map((d) => ({
    period: d.period,
    "Nasjonale løp": d[`${dataPoint}_national`],
    Mesterskap: d[`${dataPoint}_championchip`],
    Kretsløp: d[`${dataPoint}_regional`],
    Nærløp: d[`${dataPoint}_local`],
  }));

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-2"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex flex-col justify-between mb-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-2">
          {dataPoint === "number_of_events" ? "Løp" : "Starter"} pr kategori pr{" "}
          {granularity}
        </h3>

        <div className="flex justify-between items-center gap-3">
          <Select
            className="w-64"
            defaultValue="number_of_events"
            onValueChange={(value) => setDataPoint(value)}
          >
            <SelectItem value="number_of_events">Antal løp</SelectItem>
            <SelectItem value="total_starts">Starter</SelectItem>
          </Select>
          <Select
            className="w-64"
            defaultValue="month"
            onValueChange={(value) => setGranularity(value)}
          >
            <SelectItem value="month">Måned</SelectItem>
            <SelectItem value="year">År</SelectItem>
          </Select>
        </div>
      </div>

      {data.length ? (
        <LineChart
          className="h-80"
          data={chartData}
          index="period"
          categories={["Nasjonale løp", "Mesterskap", "Kretsløp", "Nærløp"]}
          colors={["lime", "fuchsia", "teal", "yellow"]}
          yAxisWidth={60}
          onValueChange={(v) => console.log(v)}
        />
      ) : (
        <Spinner />
      )}
    </Card>
  );
}
