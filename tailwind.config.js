/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#020617',
        panel: '#0f172a',
        panelSoft: '#111c31',
        gold: '#facc15'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(148, 163, 184, 0.14), 0 16px 48px rgba(2, 6, 23, 0.35)'
      }
    }
  },
  plugins: []
}
