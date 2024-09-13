import {
  BadgeDelta,
  Card,
  Divider,
  List,
  ListItem,
  Metric,
  MultiSelect,
  MultiSelectItem,
  Text,
} from "@tremor/react";
import { useEffect, useState, useCallback } from "react";

import { supabase } from "../supabaseClient";
import { Spinner } from "./Spinner";

export function PageConfig(props) {
  const { setFilter } = props;

  const [organisations, setOrganisations] = useState([]);
  const [disciplines, setDisciplines] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: organisationsData, error: organisationsError } =
        await supabase.rpc("get_organisations_by_parent");
      const { data: disciplinesData, error: disciplinesError } =
        await supabase.rpc("get_diciplines");

      if (organisationsError || disciplinesError) {
        console.error(
          "Error fetching data:",
          organisationsError,
          disciplinesError
        );
      } else {
        setOrganisations(organisationsData);
        setDisciplines(disciplinesData);

        setFilter({
          disciplines: disciplinesData.map((item) => item.disciplineId),
          organisations: organisationsData.map((item) => item.organisationId),
        });
      }
    };

    fetchData();
  }, []);

  // Debounce function
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  // Debounced filter update functions
  const updateDisciplinesFilter = useCallback(
    debounce((values) => {
      setFilter((prevFilter) => ({
        ...prevFilter,
        disciplines: values.length ? values : null,
      }));
    }, 1000),
    []
  );

  const updateOrganisationsFilter = useCallback(
    debounce((values) => {
      setFilter((prevFilter) => ({
        ...prevFilter,
        organisations: values.length ? values : null,
      }));
    }, 1000),
    []
  );

  return (
    <Card className="col-span-4">
      <div className="flex flex-col mb-2">
        <h3 className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
          Globale filter
        </h3>
        <p className="text-tremor-content dark:text-dark-tremor-content">
          Disse filterne vil påvirke alle grafer og tabeller på siden.
          <br />
          Filterne vil bli aktivert automatisk ved endring.
          <br />
          Når ingen filter er valgt hentes data for alle gren og kretser.
        </p>
      </div>
      <Divider />
      <div className="flex items-center gap-4 mb-2">
        <div className="flex gap-2 flex-col">
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
              onValueChange={(e) => updateDisciplinesFilter(e)}
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
        <div className="flex flex-col gap-2">
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
              onValueChange={(e) => updateOrganisationsFilter(e)}
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
      </div>
    </Card>
  );
}
