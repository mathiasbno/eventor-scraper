import React, { useState } from "react";
import {
  Card,
  Title,
  Button,
  Select,
  SelectItem,
  Callout,
} from "@tremor/react";

import { supabase } from "../supabaseClient";

export const DownloadCSV = () => {
  const [selectedYear, setSelectedYear] = useState("2025");
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Generate year options (current year and previous 5 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const downloadEntryFeesAsCSV = async () => {
    setIsDownloading(true);
    setError("");
    setSuccess("");

    try {
      const { data, error } = await supabase
        .from("entryfees")
        .select(
          `
          eventId,
          amount,
          type,
          classType,
          name,
          events!inner (
            name,
            startDate
          )
        `
        )
        .or("valueOperator.neq.percent,valueOperator.is.null")
        .gte("events.startDate", `${selectedYear}-01-01`)
        .lte("events.startDate", `${selectedYear}-12-31`);

      // Flatten the data
      const flattenedData = data?.map((row) => ({
        eventId: row.eventId,
        amount: row.amount,
        type: row.type,
        classType: row.classType,
        name: row.name,
        eventName: row.events.name,
        eventStartDate: row.events.startDate,
      }));

      // Convert to CSV manually or use a library
      const csvContent = [
        // Header
        "eventId,amount,type,classType,name,eventName,eventStartDate",
        // Data rows
        ...flattenedData.map(
          (row) =>
            `${row.eventId},${row.amount},${row.type},${row.classType},"${row.name}","${row.eventName}",${row.eventStartDate}`
        ),
      ].join("\n");

      if (error) {
        throw error;
      }

      // After flattening (from Option 1)
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `entryfees-${selectedYear}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess(`Successfully downloaded entry fees for ${selectedYear}`);
    } catch (err) {
      setError(`Failed to download CSV: ${err.message}`);
      console.error("Download error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <Title className="mb-6">Download Entry Fees</Title>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Year
          </label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </Select>
        </div>

        <Button
          onClick={downloadEntryFeesAsCSV}
          loading={isDownloading}
          className="w-full"
          disabled={isDownloading}
        >
          {isDownloading ? "Downloading..." : "Download CSV"}
        </Button>

        {error && (
          <Callout title="Error" color="red" className="mt-4">
            {error}
          </Callout>
        )}

        {success && (
          <Callout title="Success" color="green" className="mt-4">
            {success}
          </Callout>
        )}
      </div>
    </Card>
  );
};
