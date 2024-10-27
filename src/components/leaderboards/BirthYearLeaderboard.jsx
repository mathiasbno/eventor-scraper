import { Card, List, ListItem, NumberInput } from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";

export function BirthYearLeaderboard() {
  const [birthYear, setBirthYear] = useState(1990);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setData([]);
    const { data, error } = await supabase
      .rpc("get_runners_for_year", {
        birth_year: birthYear,
        organisation_id: null,
        year: new Date().getFullYear(),
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
  }, [birthYear]);

  return (
    <Card className="col-span-2" decoration="top" decorationColor="emerald">
      <div className="flex justify-between items-center mb-5 gap-5">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Topp 10 løpere født i {birthYear} for {new Date().getFullYear()}
        </h3>
        <NumberInput
          defaultValue={"1990"}
          onValueChange={setBirthYear}
          className="mx-auto w-20"
        />
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
        <List>
          {data.map((item) => (
            <ListItem>
              <p>
                <span className="text-tremor-content-strong font-medium">
                  {item.fullName}
                </span>
                <span> ({item.organisationName})</span>
              </p>
              <span className="font-medium">{item.total_starts}</span>
            </ListItem>
          ))}
        </List>
      )}
    </Card>
  );
}
