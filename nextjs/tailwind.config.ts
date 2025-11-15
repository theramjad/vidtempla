import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    // ... existing theme config
  },
  plugins: [
    // ... other plugins
    require("tailwind-scrollbar")({ nocompatible: true }),
  ],
} satisfies Config;
