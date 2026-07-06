/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        brand: {
          blue: '#1E3A5F',
          'blue-light': '#E8F0FE',
          gray: '#374151',
          'gray-medium': '#6B7280',
          'gray-light': '#F3F4F6',
          'gray-border': '#E5E7EB',
        },
      },
    },
  },
  plugins: [],
};
