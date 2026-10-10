/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'bg-amber-600', 'bg-cyan-600', 'bg-orange-600',
    'bg-amber-900/40', 'bg-cyan-900/40', 'bg-orange-900/40',
    'border-amber-600', 'border-cyan-600', 'border-orange-600',
    'text-amber-300', 'text-cyan-300', 'text-orange-300',
    // EOD Dashboard dynamic colors
    'bg-emerald-900/20', 'bg-red-900/20', 'bg-amber-900/20', 'bg-blue-900/20',
    'text-emerald-400', 'text-red-400', 'text-amber-400', 'text-blue-400',
    'bg-emerald-700', 'bg-red-700', 'bg-amber-700', 'bg-slate-700',
    'border-emerald-700', 'border-red-700', 'border-amber-700',
    'bg-emerald-900/30', 'bg-red-900/30', 'bg-amber-900/30',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
