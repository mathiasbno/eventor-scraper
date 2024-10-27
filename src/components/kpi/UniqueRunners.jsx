import { BadgeDelta, Card } from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";
import { monthNames } from "../../helpers/chart";

export function UniqueRunners(props) {
  const { filter } = props;

  const [data, setData] = useState([]);
  const [delta, setDelta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_unique_runners_by_year", {
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

  useEffect(() => {
    setDelta(
      (data[0]?.total_unique_runners / data[1]?.total_unique_runners - 1) * 100
    );
  }, [data]);

  return (
    <Card
      className="col-span-1 flex flex-col justify-between"
      decoration="top"
      decorationColor="indigo"
    >
      <div className="flex justify-between items-center mb-2">
        <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          Antall unike løpere så langt i {new Date().getFullYear()}
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
            {data[0]?.total_unique_runners}
          </p>
          {delta ? (
            <BadgeDelta
              deltaType={delta > 0 ? "moderateIncrease" : "moderateDecrease"}
              isIncreasePositive={true}
            >
              {delta.toFixed(2)}%
            </BadgeDelta>
          ) : null}
        </div>
      )}
    </Card>
  );
}
