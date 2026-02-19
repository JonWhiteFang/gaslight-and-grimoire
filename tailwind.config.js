/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gaslight: {
          amber: '#D4A853',
          crimson: '#8B1A1A',
          slate: '#2C3E50',
          fog: '#B8C5D0',
          ink: '#1A1A2E',
          gold: '#C9A84C',
          brass: '#B5860D',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
        mono: ['Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
