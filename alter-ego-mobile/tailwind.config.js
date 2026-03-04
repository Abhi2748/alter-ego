/** @type {import('tailwindcss').Config} */
const nativewind = require("nativewind/preset");

module.exports = {
  presets: [nativewind],
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ae: {
          bg0: "#07080F",
          bg1: "#0D0F1A",
          surface: "#141824",
          surface2: "#1E2333",
          border: "#2A3050",
          violet: "#8B5CF6",
          violetDeep: "#6D28D9",
          violetGlow: "#A78BFA",
          violetLine: "#C084FC",
          ember: "#F97316",
          emberGlow: "#FB923C",
          text: "#E5E7EB",
          text2: "#9CA3AF",
          muted: "#6B7280",
          danger: "#7F1D1D",
        },
      },
      spacing: {
        aeXs: 4,
        aeSm: 8,
        aeMd: 16,
        aeLg: 24,
        aeXl: 32,
        aeXxl: 40,
        aeXxxl: 48,
        aeCardGap: 12,
        aeScreenPadding: 16,
        aeContentBottom: 96,
      },
      borderRadius: {
        aeChip: 10,
        aeCard: 16,
        aeModal: 24,
        aeFull: 9999,
      },
    },
  },
  plugins: [],
};
