import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          600: "var(--accent-600)",
          700: "var(--accent-700)",
          50: "var(--accent-50)",
        },
        emerald: { DEFAULT: "var(--emerald)", 700: "var(--emerald-700)" },
        amber2: { DEFAULT: "var(--amber)", 700: "var(--amber-700)" },
        danger: { DEFAULT: "var(--red)", 700: "var(--red-700)" },
        border: "var(--border)",
      },
      boxShadow: {
        soft: "var(--shadow-sm)",
        card: "var(--shadow)",
        lift: "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
