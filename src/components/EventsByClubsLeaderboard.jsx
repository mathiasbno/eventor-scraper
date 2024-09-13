import { Card, List, ListItem } from "@tremor/react";
import { Spinner } from "./Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../supabaseClient";

export function EventsByClubsLeaderboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .rpc("get_events_by_organisation_year", {
          year_param: new Date().getFullYear(),
        })
        .limit(10);

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setData(data);
      }
    };

    fetchData();
  }, []);

  return (
    <Card className="col-span-2" decoration="top" decorationColor="emerald">
      <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-5">
        Klubber med flest deltagere på sine løp i {new Date().getFullYear()}
      </h3>
      {data.length ? (
        <List>
          {data.map((item) => (
            <ListItem>
              <p>
                <span className="text-tremor-content-strong font-medium">
                  {item.organisationName}
                </span>
              </p>
              <span className="font-medium">{item.total_starts}</span>
            </ListItem>
          ))}
        </List>
      ) : (
        <Spinner />
      )}
    </Card>
  );
}
