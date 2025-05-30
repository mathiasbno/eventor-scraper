export const monthNames = [
  "Januar",
  "Februar",
  "Mars",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const granularityLookup = {
  week: "Uke",
  month: "Måned",
  year: "År",
};

export const transformDataForChart = (groupedData, key, filter, accumulate) => {
  const transformedData = [];

  // Get all unique periods in 'MM' format
  const periods = new Set();
  for (let i = 1; i <= 12; i++) {
    periods.add(i.toString());
  }

  // Create a data point for each period
  periods.forEach((period) => {
    const dataPoint = { period: monthNames[parseInt(period) - 1] };
    filter.forEach((year) => {
      const yearData = groupedData[year] || [];
      const items = yearData.filter((d) => {
        const date = new Date(d.period);
        return `${date.getMonth() + 1}` === period;
      });

      if (accumulate) {
        const cumulativeSum = yearData
          .filter((d) => {
            const date = new Date(d.period);
            return date.getMonth() + 1 <= parseInt(period);
          })
          .reduce((sum, item) => sum + item[key], 0);
        dataPoint[year] = cumulativeSum;
      } else {
        dataPoint[year] = items.length ? items[0][key] : 0;
      }
    });
    transformedData.push(dataPoint);
  });

  return transformedData;
};

export function groupDataByGranularity(data, granularity) {
  const groupedData = data.reduce((acc, d) => {
    const [year, period] = d.period.split("-");
    const periodKey =
      granularity === "week"
        ? `Uke ${period}`
        : monthNames[parseInt(period - 1)];

    if (!acc[periodKey]) {
      acc[periodKey] = { period: periodKey };
    }

    acc[periodKey][`Midt-uke-${year}`] = d["mid_week_starts"];
    acc[periodKey][`Helg-${year}`] = d["weekend_starts"];

    return acc;
  }, {});

  return Object.values(groupedData).sort((a, b) => a.period - b.period);
}

export function getUniqueYears(data) {
  return data.reduce((acc, d) => {
    const [year] = d.period.split("-");
    if (!acc.includes(year)) {
      acc.push(year);
    }
    return acc;
  }, []);
}

export const getYearRange = (data) => {
  const years = Object.keys(data).map(Number);
  const minYear = Math.min(...years);
  const currentYear = new Date().getFullYear();
  return [...Array(currentYear - minYear + 1)]
    .map((_, i) => (minYear + i).toString())
    .reverse();
};

export const formatTimeAgo = (dateString) => {
  const now = new Date();
  const eventDate = new Date(dateString);
  const diffInMinutes = Math.floor((now - eventDate) / (1000 * 60));

  if (diffInMinutes < 60) {
    return `${diffInMinutes} min siden`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}t siden`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days}d siden`;
  }
};
