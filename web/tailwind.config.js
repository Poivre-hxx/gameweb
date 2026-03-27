/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      colors: {
        'neon-blue': '#3b82f6',
        'glass-sky': '#38bdf8', // Sky-400，用于光晕
      },
      boxShadow: {
        'neon': '0 0 20px rgba(59, 130, 246, 0.6)',
        'glow-sky': '0 0 15px rgba(56, 189, 248, 0.8)', // 图标发光
      },
    },
  },
}

