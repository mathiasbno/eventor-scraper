// Show starts up to the point where this share of runners is covered. The rest
// are collected in one final point.
export const COVERAGE = 0.95;

// Group rows into { [year]: { counts: { [startCount]: runners }, total } }
export const groupByYear = (rows) =>
  rows.reduce((acc, { event_year, start_count, runner_count }) => {
    const year = String(event_year);
    if (!acc[year]) acc[year] = { counts: {}, total: 0 };
    acc[year].counts[start_count] = runner_count;
    acc[year].total += runner_count;
    return acc;
  }, {});

// Smallest start count where COVERAGE of a year's runners have that many starts or fewer.
const coverageCap = ({ counts, total }) => {
  const starts = Object.keys(counts)
    .map(Number)
    .sort((a, b) => a - b);
  let sum = 0;
  for (const n of starts) {
    sum += counts[n];
    if (sum >= total * COVERAGE) return n;
  }
  return starts[starts.length - 1] ?? 0;
};

// Runners in a year with at most / at least x starts.
const countLte = (counts, x) =>
  Object.entries(counts).reduce((s, [n, c]) => (Number(n) <= x ? s + c : s), 0);
const countGte = (counts, total, x) => total - countLte(counts, x - 1);

export const transformData = (grouped, years, accumulate, direction) => {
  const selected = years.filter((y) => grouped[y]);
  if (!selected.length) return [];
  const cap = Math.max(...selected.map((y) => coverageCap(grouped[y])));

  const data = [];
  for (let x = 1; x <= cap; x++) {
    const label = accumulate
      ? `${direction === "lte" ? "≤" : "≥"} ${x}`
      : `${x}`;
    const point = { period: label };
    selected.forEach((year) => {
      const { counts, total } = grouped[year];
      if (!accumulate) point[year] = counts[x] ?? 0;
      else if (direction === "lte") point[year] = countLte(counts, x);
      else point[year] = countGte(counts, total, x);
    });
    data.push(point);
  }

  // Final point for the runners beyond the cap, if there are any.
  const hasTail = selected.some((y) =>
    Object.keys(grouped[y].counts).some((n) => Number(n) > cap),
  );
  if (hasTail) {
    // ≤ mode: the curve ends at everyone. Otherwise: the runners above the cap.
    const label = !accumulate
      ? `> ${cap}`
      : direction === "lte"
        ? "Alle"
        : `≥ ${cap + 1}`;
    const point = { period: label };
    selected.forEach((year) => {
      const { counts, total } = grouped[year];
      point[year] =
        accumulate && direction === "lte"
          ? total
          : countGte(counts, total, cap + 1);
    });
    data.push(point);
  }
  return data;
};

// Histogram buckets: single start counts where most runners are, wider buckets for
// the long tail. `max` is Infinity for the open-ended last bucket.
const HISTOGRAM_BUCKETS = [
  { min: 1, max: 1 },
  { min: 2, max: 3 },
  { min: 4, max: 6 },
  { min: 7, max: 10 },
  { min: 11, max: 15 },
  { min: 16, max: 20 },
  { min: 21, max: 30 },
  { min: 31, max: 50 },
  { min: 51, max: Infinity },
];

const bucketLabel = ({ min, max }) =>
  min === max ? `${min}` : max === Infinity ? `${min}+` : `${min}-${max}`;

// Runners per bucket of start counts, one value per selected year (or the share of
// the year's runners in percent). Buckets after the last one that has any runners
// are left out.
export const transformHistogramData = (grouped, years, asShare = false) => {
  const selected = years.filter((y) => grouped[y]);
  if (!selected.length) return [];

  const data = HISTOGRAM_BUCKETS.map((bucket) => {
    const point = { period: bucketLabel(bucket) };
    selected.forEach((year) => {
      const runners = Object.entries(grouped[year].counts).reduce(
        (sum, [n, c]) => (n >= bucket.min && n <= bucket.max ? sum + c : sum),
        0,
      );
      point[year] = asShare ? (runners / grouped[year].total) * 100 : runners;
    });
    return point;
  });

  let last = data.length;
  while (last > 1 && selected.every((y) => data[last - 1][y] === 0)) last--;
  return data.slice(0, last);
};
