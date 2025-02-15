import {
  Button,
  Card,
  LineChart,
  List,
  ListItem,
  Select,
  SelectItem,
  TextInput,
} from "@tremor/react";
import { RiSearchLine } from "@remixicon/react";
import { Spinner } from "../Spinner";
import { useEffect, useState } from "react";

import { supabase } from "../../supabaseClient";

function groupDataByStartDate(data, grouping) {
  if (grouping === "none") {
    return data;
  }

  const groupedData = data.reduce((acc, item) => {
    const date = new Date(item.startDate);
    let key;

    if (grouping === "year") {
      key = date.getFullYear();
    } else if (grouping === "day") {
      key = date.toISOString().split("T")[0]; // YYYY-MM-DD format
    }

    if (!acc[key]) {
      acc[key] = { startDate: key, "Antall starter": 0 };
    }

    acc[key]["Antall starter"] += item["Antall starter"];

    return acc;
  }, {});

  return Object.values(groupedData);
}

export function EventSearch(props) {
  const { filter } = props;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [eventName, setEventName] = useState("");
  const [grouping, setGrouping] = useState("none");
  const [formattedData, setFormattedData] = useState([]);
  const [sortBy, setSortBy] = useState("date");
  const [isDescending, setIsDescending] = useState(true);
  const [isSearchClicked, setIsSearchClicked] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_events_by_name", {
      search_name: eventName,
      discipline_list: filter.disciplines,
      organisation_ids: filter.organisations,
    });

    setLoading(false);
    if (error) {
      console.error("Error fetching data:", error);
    } else {
      const processedDate = data
        .map((item) => ({ ...item, "Antall starter": item.total_starts }))
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      setData(processedDate);
      setIsSearchClicked(true);
    }
  };

  useEffect(() => {
    const groupedData = groupDataByStartDate(data, grouping);
    setFormattedData(groupedData);
  }, [grouping, data]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setIsDescending(!isDescending);
    } else {
      setSortBy(field);
      setIsDescending(field === "date");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const sortComparator =
      sortBy === "date"
        ? (a, b) => new Date(a.startDate) - new Date(b.startDate)
        : (a, b) => a.eventName.localeCompare(b.eventName);

    return isDescending ? -sortComparator(a, b) : sortComparator(a, b);
  });  

  return (
    <Card className="col-span-2" decoration="top" decorationColor="emerald">
      <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-5">
        Sammenlign løp på navn{eventName ? `: "${eventName}"` : ""}
      </h3>
      <div className="flex gap-5 mb-5">
        <TextInput
          icon={RiSearchLine}
          placeholder="Søk på løpsnavn..."
          onChange={(e) => setEventName(e.target.value)}
        />
        <Button variant="secondary" onClick={fetchData} disabled={!eventName}>
          Søk
        </Button>
      </div>

      <div>
        <Select
          className="w-64 mt-1"
          defaultValue="none"
          onValueChange={(value) => setGrouping(value)}
        >
          <SelectItem value="none">Ingen gruppering</SelectItem>
          <SelectItem value="year">År</SelectItem>
          <SelectItem value="day">Dag</SelectItem>
        </Select>
      </div>

      {isSearchClicked && sortedData.length > 0 && (
        <div className="flex gap-3 mt-5">
          {["date", "name"].map((field) => (
            <Button
              key={field}
              variant={sortBy === field ? "primary" : "secondary"}
              onClick={() => handleSort(field)}
            >
              {field === "date" ? "Dato" : "Navn"}
              {sortBy === field && <span>{isDescending ? " ↓" : " ↑"}</span>}
            </Button>
          ))}
        </div>
      )}

      {!loading ? (
        <>
          {data.length ? (
            <>
              <LineChart
                className="h-80 mb-5"
                data={formattedData}
                index="startDate"
                autoMinValue={false}
                categories={["Antall starter"]}
                colors={["indigo", "rose"]}
                yAxisWidth={60}
                onValueChange={(v) => console.log(v)}
              />
              <List>
                {sortedData.map((item, index) => (
                  <ListItem key={`event-${index}`}>
                    <p>
                      <a
                        className="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                        href={`https://eventor.orientering.no/Events/Show/${item.eventId}`}
                        target="_blank"
                      >
                        {item.eventName}
                      </a>
                      <span>
                        {" "}
                        ({item.organisationNames} -{" "}
                        {new Date(item.startDate).getFullYear()})
                      </span>
                    </p>
                    <span className="font-medium">{item.total_starts}</span>
                  </ListItem>
                ))}
              </List>
            </>
          ) : null}
        </>
      ) : (
        <div className="flex justify-center items-center h-80">
          <Spinner />
        </div>
      )}
      <p className="text-tremor-content text-xs dark:text-dark-tremor-content mt-5">
        Antall starter som registrert i Eventor. Om resultater mangler estimerer
        vi antall starter med påmeldingsantallet. Kun resultater registrert i
        Eventor blir vist. PDF-resultater og resultater fra andre
        resultatjenester blir ikke registrert.
      </p>
    </Card>
  );
}
