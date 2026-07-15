/**
 * Canonical API origin for browser fetches.
 * Dev defaults to the local Express server; production uses same-origin `/api`
 * (or `VITE_API_URL` when the SPA is hosted separately).
 */
export function getApiBaseUrl(): string {
  const isDev = import.meta.env.MODE === "development";
  return (
    import.meta.env.VITE_API_URL ||
    (isDev ? "http://localhost:8000/api" : "/api")
  );
}
