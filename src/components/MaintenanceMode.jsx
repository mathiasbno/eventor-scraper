import { RiErrorWarningFill } from "@remixicon/react";
import { Callout } from "@tremor/react";

export function MaintenanceMode() {
  return (
    <Callout
      title="System oppdateringer"
      className="col-span-4"
      variant="warning"
      icon={RiErrorWarningFill}
    >
      Vi holder på med oppdatering og vedlikehold av databasen. Noen funksjoner
      kan være utilgjengelige, henge eller vise feil tall.
    </Callout>
  );
}
