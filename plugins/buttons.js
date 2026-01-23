const plugin = require('tailwindcss/plugin');

module.exports = plugin(function ({ addComponents }) {
    addComponents({
        '.btn': {
            '@apply py-2.5 px-5 capitalize inline-block rounded-md transition-all duration-300 ease-linear border': {},
            '@apply bg-fenalco-blue text-white border-fenalco-blue hover:bg-fenalco-navy': {},
        },
        '.btn-green': {
            '@apply bg-fenalco-green text-white border-fenalco-green hover:bg-fenalco-green-lime': {},
        },
        '.btn-secondary': {
            '@apply bg-light text-black border-light hover:bg-gray-300': {},
        },
        '.btn-danger': {
            '@apply bg-fenalco-coral text-white border-fenalco-coral hover:bg-fenalco-magenta': {},
        },
        '.btn-warning': {
            '@apply bg-fenalco-yellow text-black border-fenalco-yellow hover:bg-fenalco-orange': {},
        },
        '.btn-info': {
            '@apply bg-fenalco-sky text-white border-fenalco-sky hover:bg-fenalco-turquoise-dark': {},
        },
    });
});
