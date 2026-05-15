/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sentinel: {
          background: '#F6F2EB',
          card: '#FEFCF8',
          surface: '#EDE6D8',
          border: '#D3C9B8',
          primary: '#2D6A4F',
          deep: '#1B4332',
          text: '#1C1812',
          muted: '#6B5C4E',
          healthy: '#2EAD5B',
          mild: '#D4A017',
          moderate: '#C96B1A',
          severe: '#C0392B',
        },
      },
      boxShadow: {
        panel: '0 18px 50px rgba(28, 24, 18, 0.09)',
        soft: '0 10px 30px rgba(28, 24, 18, 0.07)',
      },
      fontFamily: {
        sans: ['Figtree', 'Georgia', 'serif', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
