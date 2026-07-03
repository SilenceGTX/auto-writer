/** Tailwind and HeroUI theme configuration for Auto-Writer. */
import { heroui } from "@heroui/react";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // pnpm stores transitive deps under .pnpm, so the HeroUI theme source must
    // be referenced there for Tailwind to generate the component utility classes.
    "./node_modules/.pnpm/@heroui+theme@*/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
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
            primary: { DEFAULT: "#2563eb", foreground: "#ffffff" },
            secondary: { DEFAULT: "#7c3aed", foreground: "#ffffff" },
          },
        },
        dark: {
          colors: {
            primary: { DEFAULT: "#60a5fa", foreground: "#0b1220" },
            secondary: { DEFAULT: "#a78bfa", foreground: "#0b1220" },
          },
        },
      },
    }),
  ],
};
