/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      },
      colors: {
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        parchment: "rgb(var(--c-parchment) / <alpha-value>)"
      }
    }
  },
  plugins: []
};
