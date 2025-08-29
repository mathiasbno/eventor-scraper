import React, { useState } from "react";
import { Divider } from "@tremor/react";

import { StartsInYear } from "./components/kpi/StartsInYear";
import { UniqueRunners } from "./components/kpi/UniqueRunners";
import { YouthInYear } from "./components/kpi/YouthInYear";
import { EventsInYear } from "./components/kpi/EventsInYear";

import { EventsChartCompare } from "./components/graphs/EventsChartCompare";
import { AgeChartCohort } from "./components/graphs/AgeChartCohort";
import { AgeChart } from "./components/graphs/AgeChart";
import { EventsCategoryChart } from "./components/graphs/EventsCategoryChart";
import { EventsChart } from "./components/graphs/EventsChart";
import { ClubsLeaderboard } from "./components/leaderboards/ClubsLeaderboard";
import { DistrictsLeaderboard } from "./components/leaderboards/DistrictsLeaderboard";
import { EventsByClubsLeaderboard } from "./components/leaderboards/EventsByClubsLeaderboard";

import { PageConfig } from "./components/PageConfig";
import { Disclaimer } from "./components/Disclaimer";
import { EventsChartMidWeekVsWeekend } from "./components/graphs/EventsChartMidWeekVsWeekend";
import { Contribute } from "./components/Contribute";
import { EventSearch } from "./components/leaderboards/EventSearch";
import { DistanceChart } from "./components/graphs/DistanceChart";
import { LightConditionsChart } from "./components/graphs/LightConditionsChart";
import { EntryFeesChart } from "./components/graphs/EntryFeesChart";
import { EventsMap } from "./components/EventsMap";
import { Metadata } from "./components/Metadata";
import { DownloadCSV } from "./components/DownloadCSV";

function App() {
  const [filter, setFilter] = useState(null);

  const query = new URLSearchParams(window.location.search);
  const showExperimental = query.has("experimental");

  return (
    <>
      <div className="bg-[#f8f8f8] dark:bg-[#0e1423]">
        <div className="flex flex-wrap md:grid grid-cols-4 gap-x-4 gap-y-4 p-5 max-w-screen-xl mx-auto bg-[#f8f8f8] dark:bg-[#0e1423]">
          <Contribute />
          <PageConfig filter={filter} setFilter={setFilter} />
          {filter ? (
            <>
              <StartsInYear filter={filter} />
              <UniqueRunners filter={filter} />
              <EventsInYear filter={filter} />
              <YouthInYear filter={filter} />
              <Divider className="col-span-4">
                <h2 className="text-tremor-content-strong text-2xl dark:text-dark-tremor-content-strong">
                  Starter pr år
                </h2>
              </Divider>
              <EventsChartCompare filter={filter} />
              <EventsCategoryChart filter={filter} />
              <EventsChart filter={filter} />
              <EventsChartMidWeekVsWeekend filter={filter} />
              <DistanceChart filter={filter} />
              <LightConditionsChart filter={filter} />
              <AgeChartCohort filter={filter} />
              <AgeChart filter={filter} />
              <EntryFeesChart filter={filter} />
              <Divider className="col-span-4">
                <h2 className="text-tremor-content-strong text-2xl dark:text-dark-tremor-content-strong">
                  Topp 10 i {filter.year}
                </h2>
              </Divider>
              <ClubsLeaderboard filter={filter} />
              <EventsByClubsLeaderboard filter={filter} />
              <DistrictsLeaderboard filter={filter} />
              <EventSearch filter={filter} />
              <EventsMap filter={filter} />
            </>
          ) : null}

          <Metadata />
          <Disclaimer />
          {showExperimental ? <DownloadCSV /> : null}
        </div>
      </div>
    </>
  );
}

export default App;
