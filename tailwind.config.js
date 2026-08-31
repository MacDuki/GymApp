/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        card: "#14141c",
        card2: "#1c1c26",
        border: "#262636",
        accent: "#7c5cff",
        accent2: "#a78bfa",
        muted: "#9aa0b2",
        dim: "#5a5f72"
      }
    }
  },
  plugins: []
}
