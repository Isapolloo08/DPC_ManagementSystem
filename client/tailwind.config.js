/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          DEFAULT: "#2C3968",
          50: "#F0F3FA",
          100: "#DCE3F2",
          200: "#B8C7E5",
          300: "#8FA7D4",
          400: "#5D81BE",
          500: "#3D60A1",
          600: "#2C3968",
          700: "#222D52",
          800: "#1A223E",
          900: "#13192C",
        },
        amber: {
          DEFAULT: "#D9A441",
          50: "#FDF9EF",
          100: "#FAF0D7",
          200: "#F5E0AF",
          300: "#ECCB7D",
          400: "#E3B753",
          500: "#D9A441",
          600: "#BF8729",
          700: "#96661D",
          800: "#734C19",
          900: "#543714",
        },
        sage: {
          DEFAULT: "#6E8B74",
          50: "#F4F7F5",
          100: "#E4ECE6",
          200: "#C6D7CB",
          300: "#A3BEAA",
          400: "#85A48D",
          500: "#6E8B74",
          600: "#556E5A",
          700: "#415445",
          800: "#313F34",
          900: "#222C24",
        },
        rose: {
          DEFAULT: "#B85C56",
          50: "#FAF2F2",
          100: "#F3E0DF",
          200: "#E6C1BF",
          300: "#D49D9A",
          400: "#C47974",
          500: "#B85C56",
          600: "#9A453F",
          700: "#7C332F",
          800: "#5F2522",
          900: "#451917",
        },
        ivory: {
          DEFAULT: "#F5F0E6",
          light: "#FAF7F2",
          dark: "#E8DFC8",
        },
        charcoal: {
          DEFAULT: "#292520",
          light: "#3F3A34",
          dark: "#1A1714",
        }
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Playfair Display", "Georgia", "serif"],
      }
    },
  },
  plugins: [],
}
