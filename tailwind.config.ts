import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#131619",
        panel: "#1B1F24",
        raised: "#21262D",
        line: "#2C333B",
        hair: "#242A31",
        ink: "#ECEFF2",
        muted: "#8A929C",
        dim: "#5C646E",
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
