import { Button, Card, List, ListItem } from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";

export function RunnersLeaderboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .rpc("get_runners_for_year", {
        year_param: new Date().getFullYear(),
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
  }, []);

  return (
    <Card className="col-span-2" decoration="top" decorationColor="emerald">
      <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-5">
        Løpere med flest starter i {new Date().getFullYear()}
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
          {data.map((item) => (
            <ListItem>
              <p>
                <span className="text-tremor-content-strong font-medium">
                  {item.fullName}
                </span>
                <span> ({item.organisationName})</span>
              </p>
              <span className="font-medium">{item.result_count}</span>
            </ListItem>
          ))}
        </List>
      )}
    </Card>
  );
}
