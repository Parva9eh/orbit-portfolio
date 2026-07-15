import axios from "axios";

const JPL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ORBIT-portfolio/1.0 (educational; contact local-dev)",
};

export async function axiosGetJson<T>(
  url: string,
  timeout: number,
  retries = 1
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await axios.get<T>(url, {
        timeout,
        headers: JPL_HEADERS,
        // Accept 2xx only as success; 502/503 from nginx throw for retry
        validateStatus: (s) => s >= 200 && s < 300,
      });
      return resp.data;
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 400 + i * 400));
      }
    }
  }
  throw lastErr;
}

