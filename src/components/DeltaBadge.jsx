import { BadgeDelta } from "@tremor/react";

export function DeltaBadge(props) {
  const { delta } = props;

  if (isNaN(delta)) {
    return null;
  }

  return delta !== null ? (
    <BadgeDelta
      deltaType={
        delta > 0
          ? "moderateIncrease"
          : delta < 0
          ? "moderateDecrease"
          : "unchanged"
      }
      isIncreasePositive={true}
    >
      {`${delta.toFixed(2)}%`}
    </BadgeDelta>
  ) : null;
}
