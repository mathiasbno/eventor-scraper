import { BarChart, Card, MultiSelect, Select, SelectItem } from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";

export function EntryFeesChart(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [type, setType] = useState("adult");
  const [classtype, setClasstype] = useState("normal");
  const [period, setPeriod] = useState([]);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const { data, error } = await supabase.rpc("get_entry_fees_by_period", {
        // granularity: "year",
        // organisation_ids: filter.organisations,
        // discipline_list: filter.disciplines,
      });

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setData(data);
        setLoading(false);
      }
    };

    fetchData();
  }, [filter]);

  const uniquePeriods = Array.from(
    new Set(data.map((d) => d.period.toString()).flat())
  ).sort();

  useEffect(() => {
    setPeriod(uniquePeriods[uniquePeriods.length - 1]);
  }, [data]);

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-2"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start flex-col  mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-2">
          Påmeldingsavgift pr aldersklasse
        </h3>

        <div className="flex flex-col justify-between items-center gap-3">
          <Select
            className="w-64"
            defaultValue="adult"
            onValueChange={(value) => setType(value)}
          >
            <SelectItem value="youth">Ungdom</SelectItem>
            <SelectItem value="adult">Voksen</SelectItem>
            <SelectItem value="kids">Barn</SelectItem>
            <SelectItem value="not_specified">Ikke spesifisert</SelectItem>
          </Select>
          <Select
            className="w-64"
            defaultValue="normal"
            onValueChange={(value) => setClasstype(value)}
          >
            <SelectItem value="open">Åpen klasse</SelectItem>
            <SelectItem value="normal">Ordinære klasser</SelectItem>
          </Select>

          <Select
            className="w-64"
            defaultValue="2024"
            onValueChange={(e) => setPeriod(e)}
          >
            {uniquePeriods.map((item) => (
              <SelectItem value={item} key={`year-${item}`}>
                {item}
              </SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex justify-center items-center h-80">
        {!loading ? (
          <BarChart
            className="h-80"
            data={data.filter(
              (item) =>
                item.period === parseInt(period) &&
                item[`${classtype}_${type}_count`] > 0
            )}
            index="amount"
            showLegend={false}
            categories={[`${classtype}_${type}_count`]}
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
        ) : (
          <Spinner />
        )}
      </div>
    </Card>
  );
}
