/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        onb: {
          green: '#00A854',
          'green-hover': '#00964B',
          'green-light': '#E6F4EA',
          'green-subtle': '#E8F5E9',
          'green-pill': '#E8F5E9',
          'peach-bg': '#FEF3E2',
          'peach-text': '#D97706',
          'input-bg': '#F3F4F6',
          'card-border': '#EAECF0',
          'text-primary': '#111827',
          'text-secondary': '#6B7280',
          'text-muted': '#9CA3AF',
        },
        latte: {
          50: '#FAF7F2',
          100: '#F4ECE1',
          200: '#E8DCCF',
          300: '#D9C8B5',
          400: '#BFAB95',
          500: '#8C6239',
          600: '#78532F',
          700: '#644425',
          800: '#4F351D',
          900: '#2D231B',
        },
        dark: {
          bg: '#0B0F17',
          surface: '#111827',
          card: '#1F2937',
          border: '#374151',
          hover: '#2D3748',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        glow: '0 0 25px rgba(79, 70, 229, 0.35)',
      }
    },
  },
  plugins: [],
}
