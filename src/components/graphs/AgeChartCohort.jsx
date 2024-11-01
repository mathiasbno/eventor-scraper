import {
  Button,
  Card,
  LineChart,
  MultiSelect,
  MultiSelectItem,
  Switch,
} from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { Spinner } from "../Spinner";
import { monthNames } from "../../helpers/chart";

export function AgeChartCohort(props) {
  const { filter } = props;

  const defaultFilter = [
    "2000",
    "2001",
    "2002",
    "2003",
    "2004",
    "2005",
    "2006",
    "2007",
    "2008",
    "2009",
    "2010",
    "2011",
    "2012",
  ];

  const [loading, setLoading] = useState(false);
  const [dataOrigin, setDataOrigin] = useState([]);
  const [data, setData] = useState([]);
  const [birthYearCategories, setBirthYearCategories] = useState([]);
  const [accumulate, setAccumulate] = useState(false);
  const [localFilter, setLocalFilter] = useState(defaultFilter);
  const [error, setError] = useState(null);

  const formatDataForChart = (data) => {
    // Extract all unique birth years to use as categories for the chart
    const birthYears = [...new Set(data.map((item) => item.birth_year))];

    // Format the data into the structure required by the LineChart
    let chartData = data.reduce((acc, item) => {
      let yearEntry = acc.find((entry) => entry.event_year === item.event_year);
      if (!yearEntry) {
        yearEntry = { event_year: item.event_year };
        acc.push(yearEntry);
      }
      yearEntry[item.birth_year] = item.participant_count;
      return acc;
    }, []);

    // If accumulation is enabled, accumulate starts for each cohort over time
    if (accumulate) {
      chartData = accumulateStarts(chartData, birthYears);
    }

    return { formattedData: chartData, categories: birthYears };
  };

  const accumulateStarts = (data, birthYears) => {
    // Accumulate starts for each cohort over time
    return data.reduce((acc, current, index) => {
      if (index === 0) return [current]; // First year, nothing to accumulate

      const previous = acc[index - 1];
      const accumulatedYear = { ...current };

      // Accumulate for each birth year category
      birthYears.forEach((birthYear) => {
        accumulatedYear[birthYear] =
          (current[birthYear] || 0) + (previous[birthYear] || 0);
      });

      acc.push(accumulatedYear);
      return acc;
    }, []);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc(
      "get_participation_by_birth_year_cohort",
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
      // Transform the data to use human-readable labels
      setDataOrigin(
        data
          .filter(
            (item) =>
              item.birth_year !== null &&
              item.birth_year > 1920 &&
              item.birth_year < new Date().getFullYear() - 9
          )
          .sort((a, b) => a.event_year - b.event_year)
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  useEffect(() => {
    const { formattedData, categories } = formatDataForChart(dataOrigin);
    setData(formattedData);
    setBirthYearCategories(categories.sort((a, b) => a - b));
  }, [accumulate, dataOrigin]);

  return (
    <Card
      className="flex flex-col content-center justify-center col-span-2"
      decoration="top"
      decorationColor="fuchsia"
    >
      <div className="flex justify-between items-start flex-col mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Antall starter pr årskull
        </h3>

        <div className="flex md:flex-row flex-col items-start justify-between md:items-center gap-3">
          <div className="flex flex-row gap-3">
            <label
              htmlFor="switch"
              className="text-tremor-default text-tremor-content dark:text-dark-tremor-content"
            >
              Akkumulert pr år
            </label>
            <Switch
              id="switch"
              name="switch"
              checked={accumulate}
              onChange={setAccumulate}
            />
          </div>

          <MultiSelect
            className="w-64"
            defaultValue={defaultFilter}
            onValueChange={(e) => setLocalFilter(e)}
          >
            {birthYearCategories.map((item) => (
              <MultiSelectItem
                value={item.toString()}
                key={`birth-year-${item}`}
              >
                {item.toString()}
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
            className="h-96"
            data={data}
            index="event_year" // X-axis represents the event year
            categories={birthYearCategories.filter((item) =>
              localFilter.includes(item.toString())
            )} // Use dynamically generated categories
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
        ).toLocaleDateString("nb-NO")})`}
      </p>
    </Card>
  );
}
