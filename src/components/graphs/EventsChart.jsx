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

export function EventsChart(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [localFilter, setLocalFilter] = useState(["Alle starter"]);
  const [granularity, setGranularity] = useState("year");

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const { data, error } = await supabase.rpc("get_events_by_granularity", {
        granularity,
        organisation_ids: filter.organisations,
        // discipline_list: filter.disciplines, // diciplines are always returned
      });

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setData(data);
        setLoading(false);
      }
    };

    fetchData();
  }, [granularity, filter]);

  const lookup = {
    total_starts: "Alle starter",
    starts_orienteering: "Orientering",
    starts_skiorienteering: "Skiorientering",
    starts_preo: "Pre-o",
    starts_mtbo: "MTBO",
  };

  const chartData = data.map((d) => ({
    ...d,
    ...Object.keys(lookup).reduce((acc, key) => {
      acc[lookup[key]] = d[key];
      return acc;
    }, {}),
  }));

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-2"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex flex-col justify-between mb-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-2">
          Starter pr år
        </h3>

        <div className="flex justify-between items-center gap-3">
          <Select
            className="w-64"
            defaultValue="year"
            onValueChange={(value) => setGranularity(value)}
          >
            <SelectItem value="month">Måned</SelectItem>
            <SelectItem value="year">År</SelectItem>
          </Select>

          <MultiSelect
            className="w-64"
            defaultValue={["Alle starter"]}
            onValueChange={(e) => setLocalFilter(e)}
          >
            {Object.keys(lookup)
              .map((key) => lookup[key])
              .map((item) => (
                <MultiSelectItem value={item} key={`dicipline-${item}`}>
                  {item}
                </MultiSelectItem>
              ))}
          </MultiSelect>
        </div>
      </div>

      {!loading ? (
        <LineChart
          className="h-80"
          data={chartData}
          index="period"
          autoMinValue={true}
          categories={localFilter}
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
