/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta institucional H&D Medical Insumos, extraída del logo oficial
        brand: {
          50: '#f4f7fc',
          100: '#e7edf8',
          200: '#cdd9ef',
          300: '#b4c7e5', // azul claro del logo (la "H")
          400: '#7f9bd6',
          500: '#5a83cd',
          600: '#4371c5', // azul institucional principal (la "D")
          700: '#375ba0',
          800: '#2c4a80',
          900: '#233c68',
        },
      },
    },
  },
  plugins: [],
};
