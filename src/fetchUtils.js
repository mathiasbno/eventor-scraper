import dotenv from "dotenv";

dotenv.config();

const getDefaultTimeoutMs = () => Number(process.env.FETCH_TIMEOUT_MS || 45000);

const getApiBasePath = () => {
  const apiBasePath = process.env.INTERNAL_API_PATH || process.env.API_PATH;

  if (!apiBasePath) {
    throw new Error(
      "Missing API_PATH or INTERNAL_API_PATH environment variable",
    );
  }

  return apiBasePath.replace(/\/$/, "");
};

export const getApiUrl = (path) => `${getApiBasePath()}${path}`;

export const withRequestTimeout = (options = {}) => {
  if (options.signal || typeof AbortSignal?.timeout !== "function") {
    return options;
  }

  return {
    ...options,
    signal: AbortSignal.timeout(getDefaultTimeoutMs()),
  };
};

export const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, withRequestTimeout(options));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      if (i === retries - 1) {
        throw err;
      }
      console.warn(
        `Retrying fetch for ${url} (${i + 1}/${retries})`,
        err.message,
      );
    }
  }
};

export const fetchWithFallback = async (url, fallback, label) => {
  try {
    return await fetchWithRetry(url);
  } catch (error) {
    console.error(`Error fetching ${label}:`, error);
    return fallback;
  }
};

export const enrichEvent = async (event) => {
  if (!event?.eventId) {
    return event;
  }

  const eventId = event.eventId;
  const [competiorCount, results, entries, entryfees] = await Promise.all([
    fetchWithFallback(
      getApiUrl(`/competitorcount/${eventId}`),
      [],
      `competitor count for event ${eventId}`,
    ),
    fetchWithFallback(
      getApiUrl(`/results/${eventId}`),
      [],
      `results for event ${eventId}`,
    ),
    fetchWithFallback(
      getApiUrl(`/entries/${eventId}`),
      [],
      `entries for event ${eventId}`,
    ),
    fetchWithFallback(
      getApiUrl(`/entryfees/${eventId}`),
      [],
      `entry fees for event ${eventId}`,
    ),
  ]);

  return {
    ...event,
    competiorCount,
    results,
    entries,
    entryfees,
  };
};

export const fetchEvent = async (id) => {
  try {
    const _event = await fetchWithRetry(getApiUrl(`/event/${id}`));
    const event = _event[0];

    if (!event) {
      return null;
    }

    return await enrichEvent(event);
  } catch (err) {
    console.error(`Error fetching event ${id}:`, err);
    return null;
  }
};

export const fetchEvents = async (options) => {
  const params = new URLSearchParams(options);
  try {
    const events = await fetchWithRetry(getApiUrl(`/events?${params}`));
    const eventList = Array.isArray(events) ? events : [];

    return (
      await Promise.all(
        eventList
          .filter((item) =>
            ["0", "1", "2", "3", "4"].includes(item.eventClassificationId),
          )
          .map((event) => enrichEvent(event)),
      )
    ).filter(Boolean);
  } catch (err) {
    console.error("Error fetching events:", err);
    return [];
  }
};
