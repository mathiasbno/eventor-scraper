alter table "public"."entries" drop constraint "entries_classId_fkey";

alter table "public"."classes" drop constraint "classes_eventId_fkey";

alter table "public"."entries" drop constraint "entries_eventId_fkey";

alter table "public"."events" drop constraint "events_classificationId_fkey";

alter table "public"."results" drop constraint "results_classId_fkey";

alter table "public"."results" drop constraint "results_eventId_fkey";

alter table "public"."events" drop constraint "events_disciplineId_fkey";

alter table "public"."entryfees" drop constraint "entryFees_eventId_fkey";

alter table "public"."runners" drop constraint "runners_organisationId_fkey";

drop view if exists "public"."parent_organisations";

alter table "public"."classes" alter column "classId" set data type bigint using "classId"::bigint;

alter table "public"."classes" alter column "eventId" set data type bigint using "eventId"::bigint;

alter table "public"."classifications" alter column "classificationId" set data type bigint using "classificationId"::bigint;

alter table "public"."discipline" alter column "disciplineId" set data type bigint using "disciplineId"::bigint;

alter table "public"."entries" alter column "eventId" set data type bigint using "eventId"::bigint;

alter table "public"."entryfees" alter column "eventId" set data type bigint using "eventId"::bigint;

alter table "public"."events" alter column "classificationId" set data type bigint using "classificationId"::bigint;

alter table "public"."events" alter column "disciplineId" set data type bigint using "disciplineId"::bigint;

alter table "public"."events" alter column "eventId" set data type bigint using "eventId"::bigint;

alter table "public"."organisations" alter column "organisationId" set data type bigint using "organisationId"::bigint;

alter table "public"."results" alter column "classId" set data type bigint using "classId"::bigint;

alter table "public"."results" alter column "eventId" set data type bigint using "eventId"::bigint;

alter table "public"."runners" alter column "organisationId" set data type bigint using "organisationId"::bigint;

alter table "public"."results" add constraint "entries_classId_fkey" FOREIGN KEY ("classId") REFERENCES classes("classId") not valid;

alter table "public"."results" validate constraint "entries_classId_fkey";

alter table "public"."classes" add constraint "classes_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES events("eventId") not valid;

alter table "public"."classes" validate constraint "classes_eventId_fkey";

alter table "public"."entries" add constraint "entries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES events("eventId") not valid;

alter table "public"."entries" validate constraint "entries_eventId_fkey";

alter table "public"."events" add constraint "events_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES classifications("classificationId") not valid;

alter table "public"."events" validate constraint "events_classificationId_fkey";

alter table "public"."results" add constraint "results_classId_fkey" FOREIGN KEY ("classId") REFERENCES classes("classId") not valid;

alter table "public"."results" validate constraint "results_classId_fkey";

alter table "public"."results" add constraint "results_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES events("eventId") not valid;

alter table "public"."results" validate constraint "results_eventId_fkey";

alter table "public"."events" add constraint "events_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES discipline("disciplineId") not valid;

alter table "public"."events" validate constraint "events_disciplineId_fkey";

alter table "public"."entryfees" add constraint "entryFees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES events("eventId") not valid;

alter table "public"."entryfees" validate constraint "entryFees_eventId_fkey";

alter table "public"."runners" add constraint "runners_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES organisations("organisationId") not valid;

alter table "public"."runners" validate constraint "runners_organisationId_fkey";

create or replace view "public"."parent_organisations" as  SELECT organisations."organisationId",
    organisations.name AS "organisationName"
   FROM organisations
  WHERE (organisations.type = '2'::text)
  ORDER BY organisations.name;



