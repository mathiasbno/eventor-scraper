import React from "react";
import { Divider } from "@tremor/react";
import { Analytics } from "@vercel/analytics/react";

import { EventsChart } from "./components/EventsChart";
import { UniqueRunners } from "./components/UniqueRunners";
import { StartsInYear } from "./components/StartsInYear";
import { RunnersLeaderboard } from "./components/RunnersLeaderboard";
import { ClubsLeaderboard } from "./components/ClubsLeaderboard";
import { DistrictsLeaderboard } from "./components/DistrictsLeaderboard";
import { EventsCategoryChart } from "./components/EventsCategoryChart";
import { EventsChartCompare } from "./components/EventsChartCompare";
import { EventsInYear } from "./components/EventsInYear";
import { BirthYearLeaderboard } from "./components/BirthYearLeaderboard";
import { AgeChart } from "./components/AgeChart";
import { YouthInYear } from "./components/YouthInYear";
import { AgeChartCohort } from "./components/AgeChartCohort";
import { EventsByClubsLeaderboard } from "./components/EventsByClubsLeaderboard";

function App() {
  return (
    <>
      <Analytics />
      <div className="flex flex-wrap md:grid grid-cols-4 gap-x-4 gap-y-4 p-12 max-w-screen-xl mx-auto">
        <StartsInYear />
        <UniqueRunners />
        <EventsInYear />
        <YouthInYear />
        <Divider className="col-span-4">
          <h2 className="text-tremor-content-strong text-2xl">Starter pr år</h2>
        </Divider>
        <EventsChartCompare />
        <AgeChartCohort />
        <AgeChart />
        <EventsCategoryChart />
        <EventsChart />
        <Divider className="col-span-4">
          <h2 className="text-tremor-content-strong text-2xl">
            Topp 10 i {new Date().getFullYear()}
          </h2>
        </Divider>
        <ClubsLeaderboard />
        <DistrictsLeaderboard />
        <EventsByClubsLeaderboard />
        {/* <BirthYearLeaderboard />
        <RunnersLeaderboard /> */}
        {/* <Divider className="col-span-4">
        <h2 className="text-tremor-content-strong text-2xl">Search</h2>
        </Divider> */}
      </div>
    </>
  );
}

export default App;
