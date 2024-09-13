import {
  BadgeDelta,
  Card,
  Divider,
  List,
  ListItem,
  Metric,
  Text,
} from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";

export function DistrictsLeaderboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .rpc("get_parent_org_stats_by_year", {
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
      <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong mb-5">
        <span className="font-medium">
          Kretser med flest starter i {new Date().getFullYear()}
        </span>{" "}
        (starter i løp hvor arrangørklubben er registrert i kretsen)
      </h3>
      {data.length ? (
        <List>
          {data.map((item, index) => (
            <ListItem key={`district-${index}`}>
              <p>
                <span className="text-tremor-content-strong font-medium">
                  {item.parentOrgName}
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