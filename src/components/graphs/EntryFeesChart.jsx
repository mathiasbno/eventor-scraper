import {
  BarChart,
  Button,
  Card,
  MultiSelect,
  Select,
  SelectItem,
} from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";

export function EntryFeesChart(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [type, setType] = useState("adult");
  const [classification, setClassification] = useState("3");
  const [classtype, setClasstype] = useState("normal");
  const [period, setPeriod] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_entry_fees", {
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
    new Set(data.map((d) => d.period.toString()).flat())
  ).sort();

  useEffect(() => {
    setPeriod(uniquePeriods[uniquePeriods.length - 1]);
  }, [data]);

  const transformedData = Object.entries(
    data
      .filter(
        (item) =>
          item.period === period &&
          item.event_classification === classification &&
          item.class_type === classtype &&
          item.type === type
      )
      .reduce((acc, item) => {
        const amount = item.amount || 0;
        if (!acc[amount]) {
          acc[amount] = 0;
        }
        acc[amount]++;
        return acc;
      }, {})
  ).map(([amount, count]) => ({ Pris: amount, Antall: count }));

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-2"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start flex-col  mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-2">
          Påmeldingsavgift pr filter kombinasjon
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            className="w-full xl:w-64"
            defaultValue="adult"
            onValueChange={(value) => setType(value)}
          >
            <SelectItem value="youth">Ungdom</SelectItem>
            <SelectItem value="adult">Voksen</SelectItem>
            <SelectItem value="kids">Barn</SelectItem>
            <SelectItem value="not_specified">Ikke spesifisert</SelectItem>
          </Select>
          <Select
            className="w-full xl:w-64"
            defaultValue="normal"
            onValueChange={(value) => setClasstype(value)}
          >
            <SelectItem value="open">Åpen klasse</SelectItem>
            <SelectItem value="normal">Ordinære klasser</SelectItem>
          </Select>

          <Select
            className="w-full xl:w-64"
            defaultValue="2024"
            onValueChange={(e) => setPeriod(e)}
          >
            {uniquePeriods.map((item) => (
              <SelectItem value={item} key={`year-${item}`}>
                {item}
              </SelectItem>
            ))}
          </Select>
          <Select
            className="w-full xl:w-64"
            defaultValue="3"
            onValueChange={(value) => setClassification(value)}
          >
            <SelectItem value="0">Internasjonalt</SelectItem>
            <SelectItem value="1">Mesterskap</SelectItem>
            <SelectItem value="2">Nasjonalt</SelectItem>
            <SelectItem value="3">Kretsløp</SelectItem>
            <SelectItem value="4">Nærløp</SelectItem>
          </Select>
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
          <BarChart
            className="h-80"
            data={transformedData}
            index="Pris"
            showLegend={false}
            categories={["Antall"]}
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
        Data hentet fra løp som har satt opp påmeldingsavgift i Eventor.
      </p>
    </Card>
  );
}
