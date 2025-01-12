import { Button, Card } from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { DeltaBadge } from "../DeltaBadge";

export function StartsInYear(props) {
  const { filter } = props;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_starts_by_year", {
      year_param: filter.year,
      organisation_ids: filter.organisations,
      discipline_list: filter.disciplines,
    });

    if (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      setLoading(false);
    } else {
      const sortedData = data.sort((a, b) => b.event_year - a.event_year);
      setData(sortedData);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const curYearData = data.find((d) => d.event_year === filter.year);
  const prevYearData = data.find((d) => d.event_year === filter.year - 1);
  const delta =
    (curYearData?.total_starts / prevYearData?.total_starts - 1) * 100;

  return (
    <Card
      className="col-span-1 flex flex-col justify-between"
      decoration="top"
      decorationColor="indigo"
    >
      <div className="flex justify-between items-center mb-2">
        <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          {filter.year === new Date().getFullYear()
            ? `Antall starter så langt i ${filter.year}`
            : `Antall starter i ${filter.year}`}
        </p>
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center">
          <Button onClick={fetchData} className="mt-2">
            Last inn på nytt
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 items-end">
          <p className="text-3xl text-tremor-content-strong dark:text-dark-tremor-content-strong font-semibold">
            {curYearData?.total_starts}
          </p>
          <DeltaBadge delta={delta} />
        </div>
      )}
    </Card>
  );
}
