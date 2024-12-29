import { Button, Card, LineChart, Select, SelectItem } from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";

import { granularityLookup } from "../../helpers/chart";

export function EventsChartMidWeekVsWeekend(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [granularity, _setGranularity] = useState("year");
  const [error, setError] = useState(null);
  const [dataPoint, setDataPoint] = useState("events");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc(
      "get_mid_week_and_weekend_starts",
      {
        organisation_ids: filter.organisations,
        discipline_list: filter.disciplines,
      }
    );

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

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-4"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start md:items-center md:flex-row flex-col mb-2 gap-2">
        <div className="flex flex-col">
          <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium ">
            Midt-uke vs helger pr {granularityLookup[granularity].toLowerCase()}{" "}
            (kretsløp og nærløp)
          </h3>
          <p className="text-tremor-content dark:text-dark-tremor-content mb-2">
            Midt-uke = mandag til torsdag, helg = fredag til søndag.
          </p>
        </div>

        <div className="flex md:flex-row flex-col justify-between items-center gap-3">
          <Select
            className="w-64"
            defaultValue="events"
            onValueChange={(value) => setDataPoint(value)}
          >
            <SelectItem value="events">Antal løp</SelectItem>
            <SelectItem value="starts">Starter</SelectItem>
          </Select>
          {/* <Select
            className="w-64"
            defaultValue="year"
            onValueChange={(value) => setGranularity(value)}
          >
            <SelectItem value="week">Uke</SelectItem>
            <SelectItem value="month">Måned</SelectItem>
            <SelectItem value="year">År</SelectItem>
          </Select>

           */}
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
            data={data.map((item) => ({
              period: item.period,
              "Midt-uke": item[`weekday_${dataPoint}`],
              Helg: item[`weekend_${dataPoint}`],
            }))}
            index="period"
            categories={["Midt-uke", "Helg"]}
            colors={["teal", "yellow", "fuchsia", "lime"]}
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
        ).toLocaleDateString("nb-NO")}).`}
        <br />
        Data er ikke påvirket av det globale grenvalget.
      </p>
    </Card>
  );
}
