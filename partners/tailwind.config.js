/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // partner theme: deep indigo + slate + gold accent — professional
        // workspace tones, clearly distinct from the customer green/amber look.
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
        },
        gold: {
          300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b',
        },
      },
      keyframes: {
        menuIn: { from: { opacity: '0', transform: 'scale(.95) translateY(-4px)' }, to: { opacity: '1', transform: 'scale(1) translateY(0)' } },
        drawerIn: { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        fadeUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        menuIn: 'menuIn .15s ease-out',
        drawerIn: 'drawerIn .2s ease-out',
        fadeUp: 'fadeUp .3s ease-out both',
      },
    },
  },
  plugins: [],
};
