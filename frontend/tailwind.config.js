/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Override indigo with shades derived from brand color #02699B
        indigo: {
          50:  '#e8f4fb',
          100: '#c5e5f5',
          200: '#8ccce9',
          300: '#44aed8',
          400: '#0d8fc1',
          500: '#047aaa',
          600: '#036591',   // lighter variant (hover / smaller buttons)
          700: '#02699B',   // ← primary brand colour
          800: '#024f75',
          900: '#01324a',
        },
      },
    },
  },
  plugins: [],
};
