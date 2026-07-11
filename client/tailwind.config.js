/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Ensure all relevant files are scanned
  ],
  theme: {
    extend: {
      colors: {
        "custom-dark": "#1A202C", // Black background
        "custom-gray": "#2D3748", // Dark gray for sidebar
        "custom-blue": "#3182CE", // Blue accents
      },
    },
  },
  plugins: [],
};
