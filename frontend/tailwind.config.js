/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        med: {
          bg: '#0A0E17',
          card: '#121826',
          cardBorder: '#1F293D',
          navy: '#0F172A',
          blue: '#1E293B',
          cyan: '#06B6D4',
          teal: '#14B8A6',
          amber: '#F59E0B',
          red: '#EF4444',
          green: '#10B981',
          textMuted: '#94A3B8',
          textBright: '#F8FAFC'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    },
  },
  plugins: [],
}
