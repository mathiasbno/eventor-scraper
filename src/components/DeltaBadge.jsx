import {
  RiArrowRightDownLine,
  RiArrowRightLine,
  RiArrowRightUpLine,
} from "@remixicon/react";

export function DeltaBadge(props) {
  const { delta } = props;

  if (!Number.isFinite(delta)) {
    return null;
  }

  const variant =
    delta > 0
      ? {
          Icon: RiArrowRightUpLine,
          className:
            "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-400/30",
        }
      : delta < 0
        ? {
            Icon: RiArrowRightDownLine,
            className:
              "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/12 dark:text-rose-300 dark:ring-rose-400/30",
          }
        : {
            Icon: RiArrowRightLine,
            className:
              "bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-500/12 dark:text-slate-300 dark:ring-slate-400/25",
          };

  const { Icon, className } = variant;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-tremor-small px-2.5 py-1 text-sm ring-1 ring-inset ${className}`}
    >
      <Icon className="-ml-1 mr-1 h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{`${delta.toFixed(2)}%`}</span>
    </span>
  );
}
