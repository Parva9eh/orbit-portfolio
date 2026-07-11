// src/utils/env.js
export const importMetaEnv = {
  VITE_NODE_ENV: import.meta.env.VITE_NODE_ENV || "development",
  // Add other env vars as needed
};
