import { Button, Card, List, ListItem } from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";

export function BiggestEventsLeaderboard(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .rpc("get_biggest_events_year", {
        year_param: filter.year,
        organisation_ids: filter.organisations,
        discipline_list: filter.disciplines,
      })
      .limit(30);

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
    <Card className="col-span-2" decoration="top" decorationColor="emerald">
      <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-5">
        De 30 største løpene i {filter.year}
      </h3>
      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="flex flex-col items-center">
          <Button onClick={fetchData} className="mt-2">
            Last inn på nytt
          </Button>
        </div>
      ) : (
        <List>
          {data.map((item, index) => (
            <ListItem key={`event-${item.eventId}`}>
              <p>
                <span className="text-tremor-content mr-2">{index + 1}.</span>
                <a
                  className="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                  href={`https://eventor.orientering.no/Events/Show/${item.eventId}`}
                  target="_blank"
                >
                  {item.eventName}
                </a>
                <span> ({item.organisationNames})</span>
              </p>
              <span className="font-medium">{item.total_starts}</span>
            </ListItem>
          ))}
        </List>
      )}
      <p className="text-tremor-content text-xs dark:text-dark-tremor-content mt-5">
        Antall starter som registrert i Eventor. Flerdagersløp telles som ett
        løp. Om resultater mangler estimerer vi antall starter med
        påmeldingsantallet.
      </p>
    </Card>
  );
}
