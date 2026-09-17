import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { canvas: "#101411", panel: "#191e1a", mint: "#bcf7a2", muted: "#929b94" },
    fontFamily: { sans: ["Arial", "Helvetica", "sans-serif"] },
  } },
  plugins: [],
} satisfies Config;
