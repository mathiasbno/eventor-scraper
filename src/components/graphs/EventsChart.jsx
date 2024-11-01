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

export function EventsChart(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [localFilter, setLocalFilter] = useState([
    "Orientering",
    "Skiorientering",
    "Pre-o",
    "MTBO",
  ]);
  const [granularity, setGranularity] = useState("year");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_events_by_discipline", {
      granularity,
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
  }, [granularity, filter]);

  const lookup = {
    total_starts: "Alle starter",
    total_starts_o: "Orientering",
    total_starts_s: "Skiorientering",
    total_starts_p: "Pre-o",
    total_starts_m: "MTBO",
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
      <div className="flex justify-between items-start flex-col  mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium flex justify-between items-start flex-col  mb-2 gap-2">
          Starter pr {granularityLookup[granularity].toLowerCase()}
        </h3>

        <div className="flex md:flex-row flex-col justify-between items-center gap-3">
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
            defaultValue={["Orientering", "Skiorientering", "Pre-o", "MTBO"]}
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
            autoMinValue={true}
            categories={localFilter}
            colors={["indigo", "rose"]}
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
