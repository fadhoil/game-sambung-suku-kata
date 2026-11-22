import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palet "Airy Blue Delight"
        airy: {
          50: "#F8F9FB",
          100: "#E1ECF7",
          200: "#AECBEB",
          300: "#83B0E1",
          400: "#71A5DE",
        },
        bg: {
          start: "#F8F9FB",
          end: "#E1ECF7",
        },
        surface: "#FFFFFF",
        accent: {
          from: "#AECBEB",
          to: "#71A5DE",
          // Biru lebih pekat khusus untuk teks di atas putih (kontras >= 4.5:1).
          deep: "#3C74B6",
        },
        peach: "#FBCFE8",
        cream: "#FDE2C8",
        sage: {
          bg: "#A7D7C5",
          text: "#3F8F77",
        },
        coral: {
          bg: "#F4A6A6",
          text: "#C96A6A",
        },
        ink: {
          DEFAULT: "#243350",
          soft: "#5C6C86",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(60, 116, 182, 0.28)",
        "soft-sm": "0 4px 14px -6px rgba(60, 116, 182, 0.22)",
      },
      keyframes: {
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-6px)" },
          "75%": { transform: "translateX(6px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "slide-in": "slide-in 0.3s ease-out",
        "pop-in": "pop-in 0.25s ease-out",
        shake: "shake 0.4s ease-in-out",
        "pulse-soft": "pulse-soft 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
