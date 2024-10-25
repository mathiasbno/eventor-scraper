import { Button, Card, MultiSelect, MultiSelectItem } from "@tremor/react";
import { useEffect, useState } from "react";

import { supabase } from "../supabaseClient";
import { Spinner } from "./Spinner";

const blackListedOrganisations = ["3591"];

export function PageConfig(props) {
  const { setFilter } = props;

  const [organisations, setOrganisations] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState([]);
  const [selectedOrganisations, setSelectedOrganisations] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: organisationsData, error: organisationsError } =
        await supabase
          .from("organisations")
          .select("organisationId, name")
          .eq("type", "2");
      const { data: disciplinesData, error: disciplinesError } = await supabase
        .from("discipline")
        .select("disciplineId, name");

      if (organisationsError || disciplinesError) {
        console.error(
          "Error fetching data:",
          organisationsError,
          disciplinesError
        );
      } else {
        setOrganisations(
          organisationsData.filter(
            (item) => !blackListedOrganisations.includes(item.organisationId)
          )
        );
        setDisciplines(disciplinesData);

        setFilter({
          disciplines: null,
          organisations: null,
        });
      }
    };

    fetchData();
  }, []);

  const handleFilterClick = () => {
    setFilter({
      disciplines: selectedDisciplines.length ? selectedDisciplines : null,
      organisations: selectedOrganisations.length
        ? selectedOrganisations
        : null,
    });
  };

  return (
    <Card className="col-span-4">
      <div className="flex flex-col gap-2 mb-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Globale filter
        </h3>
        <div className="flex md:flex-row flex-col gap-2 justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-tremor-content dark:text-dark-tremor-content text-xs">
              Disse filterne vil påvirke <i>nesten</i> alle grafer og tabeller
              på siden.
              <br />
              Når ingen filter er valgt hentes data for alle gren og kretser.
            </p>
          </div>
          <div className="flex item-start md:items-center md:flex-row flex-col gap-4 mb-2">
            <div className="flex gap-1 flex-col">
              <label
                htmlFor="dicipline"
                className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content"
              >
                Gren
              </label>
              {disciplines.length ? (
                <MultiSelect
                  id="dicipline"
                  className="w-64"
                  onValueChange={(e) => setSelectedDisciplines(e)}
                  value={selectedDisciplines}
                >
                  {disciplines.map((item) => (
                    <MultiSelectItem
                      value={item.disciplineId}
                      key={`discipline-${item.disciplineId}`}
                    >
                      {item.name}
                    </MultiSelectItem>
                  ))}
                </MultiSelect>
              ) : (
                <Spinner />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="organisations"
                className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content"
              >
                Krets
              </label>
              {organisations.length ? (
                <MultiSelect
                  id="organisations"
                  className="w-64"
                  onValueChange={(e) => setSelectedOrganisations(e)}
                  value={selectedOrganisations}
                >
                  {organisations.map((item) => (
                    <MultiSelectItem
                      value={item.organisationId}
                      key={`organisation-${item.organisationId}`}
                    >
                      {item.organisationName}
                    </MultiSelectItem>
                  ))}
                </MultiSelect>
              ) : (
                <Spinner />
              )}
            </div>
            <Button
              variant="primary"
              onClick={handleFilterClick}
              className="self-start md:self-end"
            >
              Filtrer
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
