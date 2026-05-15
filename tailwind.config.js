/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sentinel: {
          background: '#F6F8F5',
          card: '#FFFFFF',
          surface: '#EEF3ED',
          border: '#D8E0D6',
          primary: '#1F7A4D',
          deep: '#0F3D2E',
          text: '#17211B',
          muted: '#526157',
          healthy: '#2EAD5B',
          mild: '#F2C94C',
          moderate: '#F2994A',
          severe: '#EB5757',
        },
      },
      boxShadow: {
        panel: '0 18px 50px rgba(23, 33, 27, 0.08)',
        soft: '0 10px 30px rgba(23, 33, 27, 0.07)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
