import {
  Button,
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
import { granularityLookup } from "../../helpers/chart";

const tiltData = (data, uniquePeriods, uniqueDistances) => {
  return uniquePeriods.map((period) => {
    const periodData = { period };

    uniqueDistances.forEach((distance) => {
      const item = data.find(
        (item) => item.period === period && item.distance === distance
      );

      periodData[distance || "ukjent"] = {
        events: item?.total_events || 0,
        starts: item?.total_starts || 0,
      };
    });

    return periodData;
  });
};

export function DistanceChart(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [selectedDistances, setSelectedDistances] = useState([
    "Long",
    "Sprint",
    "ukjent",
  ]);
  const [dataPoint, setDataPoint] = useState("events");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_events_by_distance", {
      granularity: "year",
      organisation_ids: filter.organisations,
      discipline_list: filter.disciplines,
    });

    if (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      setLoading(false);
    } else {
      setData(data);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const uniquePeriods = Array.from(
    new Set(data.map((d) => d.period).flat())
  ).sort();

  const uniqueDistances = Array.from(
    new Set(data.map((d) => d.distance).flat())
  ).sort();

  const chartData = tiltData(data, uniquePeriods, uniqueDistances);

  const lookup = {
    events: "Løp",
    starts: "Starter",
  };

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-2"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start flex-col  mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-2">
          {lookup[dataPoint]} pr distanse
        </h3>

        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <Select
            className="w-64"
            defaultValue="events"
            onValueChange={(value) => setDataPoint(value)}
          >
            <SelectItem value="events">Antall løp</SelectItem>
            <SelectItem value="starts">Antall starter</SelectItem>
          </Select>

          <MultiSelect
            className="w-64"
            defaultValue={["Long", "Sprint", "ukjent"]}
            onValueChange={(e) => setSelectedDistances(e)}
          >
            {uniqueDistances.map((item) => (
              <MultiSelectItem
                value={item || "ukjent"}
                key={`distance-${item || "ukjent"}`}
              >
                {item || "ukjent"}
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
            data={chartData.map((item) => ({
              period: item.period,
              ...selectedDistances.reduce((acc, distance) => {
                acc[distance] = item[distance]?.[dataPoint] ?? 0;
                return acc;
              }, {}),
            }))}
            index="period"
            autoMinValue={true}
            categories={selectedDistances}
            colors={[
              "indigo",
              "rose",
              "lime",
              "fuchsia",
              "teal",
              "yellow",
              "red",
            ]}
            yAxisWidth={60}
            onValueChange={(v) => console.log(v)}
          />
        )}
      </div>
      <p className="text-tremor-content text-xs dark:text-dark-tremor-content mt-5">
        {`Data sammenlignet med samme dato som tidligere år (feks: ${new Date().toLocaleDateString(
          "nb-NO"
        )} sammenlignet med data frem til ${new Date(
          new Date().setFullYear(new Date().getFullYear() - 4)
        ).toLocaleDateString("nb-NO")})`}
      </p>
    </Card>
  );
}
