/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'bg-amber-600', 'bg-cyan-600', 'bg-orange-600',
    'bg-amber-900/40', 'bg-cyan-900/40', 'bg-orange-900/40',
    'border-amber-600', 'border-cyan-600', 'border-orange-600',
    'text-amber-300', 'text-cyan-300', 'text-orange-300',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
