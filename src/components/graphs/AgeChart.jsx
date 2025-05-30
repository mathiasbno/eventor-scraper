import {
  Button,
  Card,
  LineChart,
  MultiSelect,
  MultiSelectItem,
} from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";
import { monthNames } from "../../helpers/chart";

export function AgeChart(props) {
  const { filter } = props;

  const generateDefaultFilter = () => {
    const currentYear = new Date().getFullYear();
    const prevYears = currentYear - 5;
    return [currentYear.toString(), prevYears.toString()];
  };

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [localFilter, setLocalFilter] = useState(generateDefaultFilter());
  const [error, setError] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([
    "total_starts_under_9",
    "total_starts_9_10",
    "total_starts_11_12",
    "total_starts_13_14",
    "total_starts_15_16",
    "total_starts_ungdom",
  ]);

  const categoryLabels = {
    total_starts_under_9: "Under 9",
    total_starts_9_10: "9-10",
    total_starts_11_12: "11-12",
    total_starts_13_14: "13-14",
    total_starts_15_16: "15-16",
    total_starts_17_18: "17-18",
    total_starts_19_20: "19-20",
    total_starts_21_34: "21-34",
    total_starts_35_39: "35-39",
    total_starts_40_44: "40-44",
    total_starts_45_49: "45-49",
    total_starts_50_54: "50-54",
    total_starts_55_59: "55-59",
    total_starts_60_64: "60-64",
    total_starts_65_69: "65-69",
    total_starts_70_74: "70-74",
    total_starts_75_79: "75-79",
    total_starts_80_84: "80-84",
    total_starts_85_89: "85-89",
    total_starts_90_plus: "90+",
    total_starts_ungdom: "Ungdom",
    total_starts_junior: "Junior",
    total_starts_senior: "Senior",
    total_starts_veteran: "Veteran",
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_starts_by_age_group", {
      organisation_ids: filter.organisations,
      discipline_list: filter.disciplines,
    });

    if (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      setLoading(false);
    } else {
      // Transform the data to use human-readable labels
      const transformedData = data.map((item) => {
        const newItem = { ...item };
        Object.keys(categoryLabels).forEach((key) => {
          if (newItem[key] !== undefined) {
            newItem[categoryLabels[key]] = newItem[key];
            delete newItem[key];
          }
        });
        return newItem;
      });
      setData(transformedData);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  return (
    <Card
      className="flex flex-col content-center col-span-2"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start flex-col mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Antall starter pr aldersgruppe
        </h3>

        <div className="flex md:flex-row flex-col justify-between items-center gap-3">
          <MultiSelect
            className="w-64"
            defaultValue={generateDefaultFilter()}
            onValueChange={(e) => setLocalFilter(e)}
          >
            {data.map((item) => (
              <MultiSelectItem
                value={item.period.toString()}
                key={`period-${item.period}`}
              >
                {item.period.toString()}
              </MultiSelectItem>
            ))}
          </MultiSelect>

          <MultiSelect
            className="w-64"
            defaultValue={Object.keys(categoryLabels)}
            onValueChange={(e) => setSelectedCategories(e)}
          >
            {Object.entries(categoryLabels).map(([key, label]) => (
              <MultiSelectItem value={key} key={key}>
                {label}
              </MultiSelectItem>
            ))}
          </MultiSelect>
        </div>
      </div>

      <div className="flex justify-center items-center h-90">
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
            data={data.filter((item) =>
              localFilter.includes(item.period.toString())
            )}
            index="period"
            categories={selectedCategories.map((key) => categoryLabels[key])}
            colors={[
              "fuchsia",
              "lime",
              "teal",
              "yellow",
              "indigo",
              "rose",
              "cyan",
              "amber",
              "emerald",
              "orange",
              "violet",
              "sky",
              "stone",
              "pink",
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
        ).toLocaleDateString("nb-NO")}).`}
      </p>
    </Card>
  );
}
