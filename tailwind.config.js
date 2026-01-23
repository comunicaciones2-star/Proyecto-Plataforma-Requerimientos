/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,jsx,ts,tsx,hbs}',
  ],
  darkMode: ['class', '[data-mode=dark]'],
  theme: {
    extend: {
      fontFamily: {
        cerebri: ['Cerebri Sans', 'sans-serif'],
      },
      colors: {
        // Fenalco Primary Colors
        'fenalco-green': '#00CE7C',           // Verde corporativo
        'fenalco-blue': '#280071',            // Azul oscuro corporativo
        'fenalco-white': '#FFFFFF',           // Blanco
        
        // Fenalco Secondary Colors
        'fenalco-green-light-1': '#ADDC91',   // Verde claro 1
        'fenalco-green-light-2': '#9BE3BF',   // Verde claro 2
        'fenalco-green-lime': '#84BD00',      // Verde lima
        'fenalco-coral-light': '#FFA38B',     // Coral claro
        'fenalco-coral': '#FF8674',           // Coral
        'fenalco-magenta': '#890C58',         // Magenta oscuro
        'fenalco-yellow-light': '#FECB8B',    // Amarillo claro
        'fenalco-yellow': '#FFB549',          // Amarillo
        'fenalco-orange': '#C16C18',          // Naranja oscuro
        
        // Fenalco Complementary Colors
        'fenalco-turquoise-dark': '#007681',  // Turquesa oscuro
        'fenalco-turquoise': '#2CD5C4',       // Turquesa
        'fenalco-turquoise-light': '#A7E6D7', // Turquesa claro
        'fenalco-yellow-pastel': '#F8E59A',   // Amarillo pastel
        'fenalco-navy': '#0C2340',            // Azul marino
        'fenalco-sky': '#009CDE',             // Azul cielo
        'fenalco-blue-pastel': '#C6DAE7',     // Azul pastel
        'fenalco-pink-pastel': '#F5DADF',     // Rosa pastel
        'fenalco-gray-dark': '#1C1F2A',       // Gris oscuro
        'fenalco-gray-md-dark': '#4B4F54',    // Gris medio oscuro
        'fenalco-gray-md': '#75787B',         // Gris medio
        'fenalco-gray-light': '#C8C9C7',      // Gris claro
        
        // Template defaults
        transparent: 'transparent',
        current: 'currentColor',
        muted: '#94989a',
        light: '#e2e6eb',
        black: '#323a46',
        primary: '#280071',                   // Fenalco Blue como primary
        success: '#00CE7C',                   // Fenalco Green como success
        danger: '#FF8674',                    // Fenalco Coral como danger
        warning: '#FFB549',                   // Fenalco Yellow como warning
        info: '#009CDE',                      // Fenalco Sky como info
        dark: '#151515',
        darklight: '#1F1F1F',
        darkborder: '#343331',
        darkmuted: '#767273',
      },
      spacing: {
        'sidebar': '240px',
        'sidebar-collapsed': '72px',
      },
      zIndex: {
        sidebar: '9999',
        sidebarLg: '10',
      },
    },
  },
  plugins: [
    require('./plugins/layouts/layouts'),
    require('./plugins/layouts/sidebar'),
    require('./plugins/card'),
    require('./plugins/buttons'),
    require('./plugins/forms'),
  ],
}
