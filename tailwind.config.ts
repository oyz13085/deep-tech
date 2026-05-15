import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        accent:  '#e07c3a',
        palm: {
          healthy:  '#166534',
          warning:  '#a16207',
          moderate: '#9a3412',
          severe:   '#7f1d1d',
        },
      },
    },
  },
  plugins: [],
};
export default config;
