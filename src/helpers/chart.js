export const transformDataForChart = (groupedData, key, filter, accumulate) => {
  const transformedData = [];
  const monthNames = [
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
