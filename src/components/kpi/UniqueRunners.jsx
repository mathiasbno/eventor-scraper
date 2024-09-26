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

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const { data, error } = await supabase.rpc("get_unique_runners_by_year", {
        organisation_ids: filter.organisations,
        discipline_list: filter.disciplines,
      });

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        const sortedData = data.sort((a, b) => b.event_year - a.event_year);
        setData(sortedData);
        setLoading(false);
      }
    };

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
      {!loading ? (
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
      ) : (
        <Spinner />
      )}
    </Card>
  );
}
