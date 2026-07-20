import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        panel: "var(--color-panel)",
        raised: "var(--color-raised)",
        line: "var(--color-line)",
        hair: "var(--color-hair)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        dim: "var(--color-dim)",
        up: "#4FB286",
        down: "#D9685E",
        au: "#CBA135",
        ag: "#AEB7C2",
        pt: "#CBD6DF",
        pd: "#93A89B",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
