import { useState, useEffect, useMemo } from "react";
import axios from "axios";

const API_CACHE = new Map(); // In-memory cache for data

export const useApiData = (endpoint, options = {}) => {
  const [data, setData] = useState(null); // Initial state is null
  const [loading, setLoading] = useState(false); // Start with false, set only during fetch
  const [error, setError] = useState(null);

  const isDev = import.meta.env.MODE === "development";
  const baseUrl =
    import.meta.env.VITE_API_URL ||
    (isDev ? "http://localhost:8000/api" : "/api");
  const fullUrl = `${baseUrl}${endpoint}`;

  const currentOptions = useMemo(
    () => ({
      ...options,
      params: {
        ...options.params,
        page: options.params.page || 1,
        limit: options.params.limit || 10,
      },
    }),
    [options]
  );

  const cacheKey = useMemo(
    () => fullUrl + JSON.stringify(currentOptions.params),
    [fullUrl, currentOptions.params]
  );

  useEffect(() => {
    let isMounted = true;
    const shouldFetch =
      !API_CACHE.has(cacheKey) || currentOptions.cache === false;
    if (shouldFetch) setLoading(true); // Set loading only if fetch is needed

    console.log(
      "Fetching data for page:",
      currentOptions.params.page,
      cacheKey,
      { shouldFetch }
    ); // Debug
    const fetchData = async (
      retries = currentOptions.retry || (isDev ? 0 : 3)
    ) => {
      if (!shouldFetch && isMounted) {
        const cached = API_CACHE.get(cacheKey);
        if (cached && cached.data) {
          setData(cached);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await axios.get(fullUrl, {
          headers: { "Cache-Control": "no-cache" },
          params: currentOptions.params,
        });
        const result = res.data;
        if (isMounted && result && Array.isArray(result.data)) {
          setData(result);
          if (currentOptions.cache !== false) {
            API_CACHE.set(cacheKey, result);
          }
        } else if (isMounted) {
          setError(new Error("Invalid API response"));
        }
      } catch (err) {
        if (isMounted && retries > 0) {
          console.warn("API call failed, retrying...", err);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          fetchData(retries - 1);
        } else if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [cacheKey, isDev, fullUrl]);

  return { data, loading, error };
  // Note: Future WebSocket integration could supplement this with real-time updates
};
