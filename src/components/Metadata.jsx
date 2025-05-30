import { useEffect, useState } from "react";
import { Card } from "@tremor/react";

import { supabase } from "../supabaseClient";
import { formatTimeAgo } from "../helpers/chart";

export function Metadata() {
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tableCounts, setTableCounts] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get last updated time
        const { data: lastEvent, error: lastEventError } = await supabase
          .from("events")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastEventError) {
          throw lastEventError;
        }

        // Get counts for all your tables
        const tableNames = [
          "events",
          "runners",
          "results",
          "entries",
          "organisations",
          "entryfees",
          "classes",
        ];

        const counts = {};
        for (const tableName of tableNames) {
          const { count, error } = await supabase
            .from(tableName)
            .select("*", { count: "exact", head: true });

          if (!error) {
            counts[tableName] = count;
          }
        }

        setLastUpdated(lastEvent.created_at);
        setTableCounts(counts);
      } catch (err) {
        console.error("Error fetching metadata:", err);
      }
    };

    fetchData();
  }, []);

  const getDisplayText = () => {
    if (!lastUpdated) return "Ingen data funnet";
    return formatTimeAgo(lastUpdated);
  };

  console.log(new Date(lastUpdated).toISOString().split("T")[1].split(".")[0]);

  return (
    <Card className="col-span-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Metadata
        </h3>
        <p className="text-tremor-content text-xs dark:text-dark-tremor-content">
          Sist oppdatert: {getDisplayText()}
          <br />(
          {lastUpdated
            ? `${new Date(lastUpdated)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")}`
            : null}
          )
        </p>
        <p className="text-tremor-content text-xs dark:text-dark-tremor-content">
          Antall rader i tabeller: <br />
          {Object.entries(tableCounts).map(([table, count]) => (
            <span key={table}>
              {table}: {count}
              <br />
            </span>
          ))}
        </p>
      </div>
    </Card>
  );
}
