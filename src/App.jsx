import React, { useState } from "react";
import { Divider } from "@tremor/react";
import { Analytics } from "@vercel/analytics/react";

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
import { MaintenanceMode } from "./components/MaintenanceMode";

function App() {
  const [filter, setFilter] = useState(null);

  return (
    <>
      <Analytics />
      <div className="flex flex-wrap md:grid grid-cols-4 gap-x-4 gap-y-4 p-5 max-w-screen-xl mx-auto">
        <PageConfig filter={filter} setFilter={setFilter} />
        <MaintenanceMode />
        {filter ? (
          <>
            <StartsInYear filter={filter} />
            <UniqueRunners filter={filter} />
            <EventsInYear filter={filter} />
            <YouthInYear filter={filter} />
            <Divider className="col-span-4">
              <h2 className="text-tremor-content-strong text-2xl">
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
              <h2 className="text-tremor-content-strong text-2xl">
                Topp 10 i {new Date().getFullYear()}
              </h2>
            </Divider>
            <ClubsLeaderboard filter={filter} />
            <EventsByClubsLeaderboard filter={filter} />
            <DistrictsLeaderboard filter={filter} />
            <EventSearch filter={filter} />
            {/* <Divider className="col-span-4">
        <h2 className="text-tremor-content-strong text-2xl">Search</h2>
        </Divider> */}
          </>
        ) : null}
        <Disclaimer />
        <Contribute />
      </div>
    </>
  );
}

export default App;
