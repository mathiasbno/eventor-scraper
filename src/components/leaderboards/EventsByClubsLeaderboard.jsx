import { Card, List, ListItem } from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";

export function EventsByClubsLeaderboard(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const { data, error } = await supabase
        .rpc("get_events_by_organisation_year", {
          year_param: new Date().getFullYear(),
          organisation_ids: filter.organisations,
          discipline_list: filter.disciplines,
        })
        .limit(10);

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setData(data);
        setLoading(false);
      }
    };

    fetchData();
  }, [filter]);

  return (
    <Card className="col-span-2" decoration="top" decorationColor="emerald">
      <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-5">
        Klubber med flest deltagere på sine løp i {new Date().getFullYear()}
      </h3>
      {!loading ? (
        <List>
          {data.map((item, index) => (
            <ListItem key={`club-${index}`}>
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
      <p className="text-tremor-content text-xs dark:text-dark-tremor-content mt-5">
        Antall starter registrert på løp arrangert av klubben. I løp med flere
        arrangører er startene registrert på alle arrangører av løpet.
      </p>
    </Card>
  );
}
