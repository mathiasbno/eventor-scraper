import { Button, Card, LineChart, Select, SelectItem } from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";
import { granularityLookup } from "../../helpers/chart";

export function EventsCategoryChart(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [granularity, setGranularity] = useState("year");
  const [error, setError] = useState(null);
  const [dataPoint, setDataPoint] = useState("total_starts");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc(
      "get_events_by_classification_granularity",
      {
        granularity,
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
  }, [granularity, filter]);

  const chartData = data.map((d) => ({
    period: d.period,
    "Internasjonale løp": d[`${dataPoint}_international`],
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
      <div className="flex justify-between items-start flex-col  mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-2">
          {dataPoint === "number_of_events" ? "Løp" : "Starter"} pr kategori pr{" "}
          {granularityLookup[granularity].toLowerCase()}
        </h3>

        <div className="flex justify-between items-center gap-3">
          <Select
            className="w-64"
            defaultValue="total_starts"
            onValueChange={(value) => setDataPoint(value)}
          >
            <SelectItem value="number_of_events">Antall løp</SelectItem>
            <SelectItem value="total_starts">Starter</SelectItem>
          </Select>
          {/* <Select
            className="w-64"
            defaultValue="month"
            onValueChange={(value) => setGranularity(value)}
          >
            <SelectItem value="month">Måned</SelectItem>
            <SelectItem value="year">År</SelectItem>
          </Select> */}
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
            categories={[
              "Kretsløp",
              "Nærløp",
              "Nasjonale løp",
              "Mesterskap",
              "Internasjonale løp",
            ]}
            colors={["lime", "fuchsia", "teal", "yellow", "red"]}
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
