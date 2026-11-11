import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { groupByYear } from "./startCountChart";

// Event classifications imported by the scraper (classificationId -> label).
export const startCountCategories = [
  { id: "0", label: "Internasjonale løp" },
  { id: "1", label: "Mesterskap" },
  { id: "2", label: "Nasjonale løp" },
  { id: "3", label: "Kretsløp" },
  { id: "4", label: "Nærløp" },
];

// Fetches the runners-by-start-count histogram and owns the controls shared by the
// start count charts: "samme periode", event categories and selected years.
export function useRunnersByStartCount(filter) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [error, setError] = useState(null);
  const [samePeriod, setSamePeriod] = useState(true);
  // Empty means all categories.
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const lastFilter = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data: rows, error } = await supabase.rpc(
      "get_runners_by_start_count",
      {
        organisation_ids: filter.organisations,
        discipline_list: filter.disciplines,
        same_period: samePeriod,
        classification_list: selectedCategories.length
          ? selectedCategories.map(Number)
          : null,
      },
    );

    if (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
    } else {
      const grouped = groupByYear(rows);
      setData(grouped);
      // Only reset the selected years when the page filter changes, not when
      // toggling "Samme periode" or the categories.
      if (lastFilter.current !== filter) {
        lastFilter.current = filter;
        setSelectedYears(
          Object.keys(grouped)
            .sort((a, b) => b - a)
            .slice(0, 3),
        );
      } else {
        // Drop years that have no data with the new settings.
        setSelectedYears((years) => years.filter((year) => grouped[year]));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filter, samePeriod, selectedCategories]);

  const yearLabels = Object.keys(data).sort((a, b) => b - a);

  const handleYearsChange = (years) => {
    setSelectedYears(
      years.filter((year) => yearLabels.includes(year)).sort((a, b) => b - a),
    );
  };

  return {
    data,
    loading,
    error,
    fetchData,
    samePeriod,
    setSamePeriod,
    selectedCategories,
    setSelectedCategories,
    selectedYears,
    yearLabels,
    handleYearsChange,
  };
}
