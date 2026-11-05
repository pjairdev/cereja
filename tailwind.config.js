/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        blush: '#fff1ef',
        petal: '#ffe2de',
        cherry: { DEFAULT: '#d8304a', dark: '#b3263c', soft: '#ffb3bd' },
        wine: '#3d0f1e',
        mauve: '#8f6570',
        line: '#f6cfca',
        ok: '#2e8a5a',
        warn: '#b57a12',
      },
      fontFamily: {
        display: ['"Bagel Fat One"', '"Arial Rounded MT Bold"', 'sans-serif'],
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(61,15,30,.06), 0 8px 24px -12px rgba(61,15,30,.18)',
        lift: '0 2px 4px rgba(61,15,30,.06), 0 24px 48px -20px rgba(61,15,30,.35)',
      },
    },
  },
  plugins: [],
}
