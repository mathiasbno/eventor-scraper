import { fetchEventsAndInsert } from "../src/process";

export default async function handler(req, res) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 7);

  await fetchEventsAndInsert(startDate, endDate, 7);

  res.status(200).end("Events imported for the last 7 days");
}
