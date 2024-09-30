import { Card, List, ListItem } from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";

export function DistrictsLeaderboard(props) {
  const { filter } = props;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const { data, error } = await supabase.rpc("get_disctrict_starts", {
        year_param: new Date().getFullYear(),
        discipline_list: filter.disciplines,
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

  return (
    <Card className="col-span-2" decoration="top" decorationColor="emerald">
      <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong mb-5 font-medium">
        Kretser med flest starter i {new Date().getFullYear()}
      </h3>
      {!loading ? (
        <List>
          {data.map((item, index) => (
            <ListItem key={`district-${index}`}>
              <p>
                <span className="text-tremor-content-strong font-medium">
                  {item.parentorgname}
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
        Antall starter registrert på løpere registrert i klubben som tilhører
        hver krets.
      </p>
    </Card>
  );
}
