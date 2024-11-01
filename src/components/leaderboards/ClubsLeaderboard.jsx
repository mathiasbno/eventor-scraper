import { Button, Card, List, ListItem } from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";

export function ClubsLeaderboard(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .rpc("get_starts_by_organisation_year", {
        year_param: new Date().getFullYear(),
        organisation_ids: filter.organisations,
        discipline_list: filter.disciplines,
      })
      .limit(10);

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
        Klubber med flest starter i {new Date().getFullYear()}
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
            <ListItem key={`club-${index}`}>
              <p>
                <span className="text-tremor-content-strong font-medium">
                  {item.organisationName}
                </span>
              </p>
              <span className="font-medium">{item.total_result_count}</span>
            </ListItem>
          ))}
        </List>
      )}
      <p className="text-tremor-content text-xs dark:text-dark-tremor-content mt-5">
        Antall starter registrert på løpere registrert i klubben ved hver
        innlastning. Vi holder ikke styr på historiske klubbbytter eller løpere
        som har flere klubber.
      </p>
    </Card>
  );
}
