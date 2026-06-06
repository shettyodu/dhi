/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan every page and script so all literal utility classes are generated.
  content: ["./site/**/*.html", "./site/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Montserrat", "Inter", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef4fb", 100: "#d9e6f5", 200: "#b7cfe9", 300: "#8bb0d8",
          400: "#5a8bc2", 600: "#1d4e89", 700: "#143c6c", 800: "#0e3a5f",
          900: "#0a2540", 950: "#071a30",
        },
      },
    },
  },
};
