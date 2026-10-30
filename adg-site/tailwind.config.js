/** @type {import('tailwindcss').Config} */
// Standalone Tailwind build for the Asset Data Group site. Scans only this site's
// HTML so the compiled public/assets/tailwind.css contains exactly the utilities
// the ADG page uses (the DHI build is purged to the DHI pages and lacks some).
// Rebuild: from adg-site/, run
//   node ../node_modules/.bin/tailwindcss -c ./tailwind.config.js -i ./tailwind.input.css -o ./public/assets/tailwind.css --minify
module.exports = {
  content: ["./public/**/*.html"],
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
