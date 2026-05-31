import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#142033",
        muted: "#637083",
        panel: "#eef6fb",
        surface: "#ffffff",
        "surface-muted": "#f6fbff",
        "border-soft": "#d6e4ef",
        "accent-cyan": "#0ea5b7",
        "accent-indigo": "#7c83db",
        mint: "#58c7a4",
        graph: {
          blue: "#1d7fd6",
          green: "#36a982",
          amber: "#d69032",
          rose: "#d95f7a",
          lavender: "#8d8fe5",
          cyan: "#1aa6b8",
        },
      },
      boxShadow: {
        soft: "0 14px 40px rgba(52, 86, 120, 0.10)",
        line: "0 1px 0 rgba(117, 143, 163, 0.16)",
        lift: "0 18px 48px rgba(40, 77, 116, 0.16)",
      },
      borderRadius: {
        card: "8px",
      },
    },
  },
  plugins: [],
}

export default config
