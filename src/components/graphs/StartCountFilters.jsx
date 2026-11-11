import { MultiSelect, MultiSelectItem, Switch } from "@tremor/react";
import { startCountCategories } from "../../helpers/useRunnersByStartCount";

export const startCountColors = [
  "fuchsia",
  "lime",
  "teal",
  "yellow",
  "indigo",
  "rose",
  "cyan",
  "amber",
  "emerald",
  "orange",
  "violet",
  "sky",
  "stone",
  "pink",
];

export const startCountLabelClass =
  "text-tremor-default text-tremor-content dark:text-dark-tremor-content";

// "Samme periode" switch, to be placed in the chart header next to other controls.
export function SamePeriodSwitch({ id, samePeriod, setSamePeriod }) {
  return (
    <div className="flex flex-row gap-3 items-center">
      <label htmlFor={id} className={startCountLabelClass}>
        Samme periode
      </label>
      <Switch id={id} name={id} checked={samePeriod} onChange={setSamePeriod} />
    </div>
  );
}

// Event category and year pickers.
export function CategoryAndYearSelects({
  idPrefix,
  selectedCategories,
  setSelectedCategories,
  selectedYears,
  yearLabels,
  handleYearsChange,
}) {
  return (
    <>
      <MultiSelect
        className="w-64"
        placeholder="Alle kategorier"
        placeholderSearch="Søk"
        value={selectedCategories}
        onValueChange={setSelectedCategories}
      >
        {startCountCategories.map(({ id, label }) => (
          <MultiSelectItem value={id} key={`${idPrefix}-category-${id}`}>
            {label}
          </MultiSelectItem>
        ))}
      </MultiSelect>
      <MultiSelect
        className="w-64"
        value={selectedYears}
        onValueChange={handleYearsChange}
      >
        {yearLabels.map((year) => (
          <MultiSelectItem value={year} key={`${idPrefix}-year-${year}`}>
            {year}
          </MultiSelectItem>
        ))}
      </MultiSelect>
    </>
  );
}

export const startCountScopeNote =
  "Løpere uten Eventor-ID (f.eks. uregistrerte løpere) er ikke med. Ved valg av krets telles løpere fra klubber i kretsen, basert på løperens nåværende klubb, med alle deres starter uansett arrangør. Ved valg av kategori telles bare starter i løp av de valgte kategoriene.";

export const samePeriodNote = (samePeriod) =>
  samePeriod
    ? "«Samme periode» teller kun starter fram til dagens dato i hvert år, slik at inneværende år kan sammenlignes med tidligere år."
    : "Data for inneværende år viser tall til og med sist uke.";
