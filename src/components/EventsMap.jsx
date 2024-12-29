import React, { useEffect, useState, useRef } from "react";
import { Button, Card, Select, SelectItem, Switch } from "@tremor/react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import { supabase } from "../supabaseClient";

function MapBounds({ data }) {
  const map = useMap();
  const boundsSet = useRef(false);

  useEffect(() => {
    if (data.length > 0 && !boundsSet.current) {
      const positions = data.map((item) => item.position);
      const bounds = positions.reduce(
        (bounds, position) => bounds.extend(position),
        map.getBounds()
      );
      map.fitBounds(bounds, { padding: [50, 50] });
      boundsSet.current = true;
    }
  }, [data, map]);

  return null;
}

export function EventsMap(props) {
  const { filter } = props;
  const defaultPosition = [65.41795450487074, 13.41468257305932];
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(null);
  const [toggleSizeScale, setToggleSizeScale] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_events_location", {
      organisation_ids: filter.organisations,
      discipline_list: filter.disciplines,
    });

    if (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      setLoading(false);
    } else {
      setData(
        data.map((item) => {
          const location = JSON.parse(item.location);
          return {
            ...item,
            position: [location.y, location.x],
            year: new Date(item.startDate).getFullYear().toString(),
          };
        })
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const uniquePeriods = Array.from(
    new Set(data.map((d) => d.year.toString()).flat())
  ).sort();

  const chartData = data.filter((item) =>
    period ? item.year === period : true
  );

  const maxValCutoff = 3000;

  const minVal = Math.min(
    ...chartData.map((item) => item.numberOfStarts).filter((item) => item > 0)
  );
  const maxVal = Math.min(
    maxValCutoff,
    Math.max(...chartData.map((item) => item.numberOfStarts))
  );

  const getRadius = (value) => {
    const minRadius = 100; // Minimum radius in meters
    const maxRadius = 3000; // Maximum radius in meters
    if (minVal === maxVal) {
      return minRadius; // Avoid division by zero if all values are the same
    }
    return (
      ((Math.min(maxValCutoff, value) - minVal) / (maxVal - minVal)) *
        (maxRadius - minRadius) +
      minRadius
    );
  };

  const sortedChartData = chartData.sort((a, b) => {
    const radiusA = getRadius(a.numberOfStarts);
    const radiusB = getRadius(b.numberOfStarts);
    return radiusB - radiusA;
  });

  const Markeromponent = toggleSizeScale ? Circle : CircleMarker;

  return (
    <Card className="col-span-4 h-[64rem]">
      <div className="flex justify-between items-start flex-col mb-2 gap-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium mb-2">
          Løpsoversikt
        </h3>

        <p className="text-tremor-content text-xs dark:text-dark-tremor-content">
          Viser alle løp for valgt periode. Klikk på antall starter under for å
          vise sirklene i relativ størrelse ut i fra antall starter. Klikk på
          hver markør for å se detaljer inkludert link til Eventor.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-row gap-3">
            <label
              htmlFor="switch"
              className="text-tremor-default text-tremor-content dark:text-dark-tremor-content"
            >
              Antall startende
            </label>
            <Switch
              id="switch"
              name="switch"
              checked={toggleSizeScale}
              onChange={setToggleSizeScale}
            />
          </div>

          <Select
            className="w-full xl:w-64 z-[1000]"
            defaultValue=""
            onValueChange={(e) => setPeriod(e)}
          >
            <SelectItem value={""} key={`year-all`}>
              Alle år
            </SelectItem>
            {uniquePeriods.map((item) => (
              <SelectItem value={item} key={`year-${item}`}>
                {item}
              </SelectItem>
            ))}
          </Select>

          {error ? (
            <Button onClick={fetchData} className="mt-2">
              Last inn på nytt
            </Button>
          ) : null}
        </div>
      </div>
      <MapContainer
        className="markercluster-map"
        center={defaultPosition}
        zoom={5}
        scrollWheelZoom={false}
        style={{ height: "89%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {!loading && !error
          ? sortedChartData.map((item, index) => (
              <Markeromponent
                key={index}
                center={item.position}
                radius={toggleSizeScale ? getRadius(item.numberOfStarts) : 4}
                color="blue"
                fillColor="blue"
                fillOpacity={toggleSizeScale ? 0.3 : 0.5}
                stroke={false}
              >
                <Popup>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <a
                      href={`https://eventor.orientering.no/Events/Show/${item.eventId}`}
                      target="_blank"
                    >
                      {item.name}
                    </a>
                    <span>{item.numberOfStarts} starter</span>
                    <span>{item.startDate}</span>
                  </div>
                </Popup>
              </Markeromponent>
            ))
          : null}
      </MapContainer>
    </Card>
  );
}
