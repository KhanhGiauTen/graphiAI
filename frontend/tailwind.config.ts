import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        panel: "#f7f8fb",
        graph: {
          blue: "#2563eb",
          green: "#059669",
          amber: "#d97706",
          rose: "#e11d48",
        },
      },
    },
  },
  plugins: [],
}

export default config
