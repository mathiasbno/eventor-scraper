import { Card, List, ListItem, NumberInput } from "@tremor/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";

export function BirthYearLeaderboard() {
  const [birthYear, setBirthYear] = useState(1990);
  const [data, setData] = useState([]);

  useEffect(() => {
    setData([]);
    const fetchData = async () => {
      const { data, error } = await supabase
        .rpc("get_runners_by_birth_year_year", {
          birth_year_param: birthYear,
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
      {data.length ? (
        <List>
          {data.map((item) => (
            <ListItem>
              <p>
                <span className="text-tremor-content-strong font-medium">
                  {item.fullName}
                </span>
                <span> ({item.organisationName})</span>
              </p>
              <span className="font-medium">{item.total_results}</span>
            </ListItem>
          ))}
        </List>
      ) : (
        <Spinner />
      )}
    </Card>
  );
}
