/** Tailwind and HeroUI theme configuration for Auto-Writer. */
import { heroui } from "@heroui/react";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Noto Sans SC", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: "#2563eb",
            secondary: "#7c3aed",
          },
        },
        dark: {
          colors: {
            primary: "#60a5fa",
            secondary: "#a78bfa",
          },
        },
      },
    }),
  ],
};
