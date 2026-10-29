/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0D12',
        surface: '#161922',
        border: '#232633',
        accent: '#7C5CFC',
        text: '#E6E8EE',
        muted: '#8A8FA3',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl: '12px', '2xl': '16px' },
    },
  },
  plugins: [],
};