const plugin = require('tailwindcss/plugin');

module.exports = plugin(function ({ addComponents }) {
    addComponents({
        '.form-input, .form-textarea,.form-select,.form-multiselect': {
            '@apply px-3 py-2 text-[16px] w-full border border-black/10 rounded-sm bg-[#f9fbfd] dark:bg-dark dark:border-darkborder dark:placeholder:text-darkmuted dark:text-white dark:focus:border-fenalco-green text-black h-12 focus:!shadow-none focus:border-fenalco-green focus:outline-0 focus:ring-0 placeholder:text-black/50': {},
        },
        '.form-radio, .form-checkbox': {
            '@apply size-5 cursor-pointer rounded-sm border-2 border-black/10 dark:border-darkmuted dark:checked:border-transparent bg-transparent text-fenalco-green checked:border-transparent !shadow-none !outline-hidden !ring-0 !ring-offset-0 checked:bg-[length:90%_90%] disabled:cursor-not-allowed disabled:bg-transparent disabled:!border-2 disabled:!border-black/10 dark:disabled:!border-darkmuted ltr:mr-1.5 rtl:ml-1.5 hover:disabled:bg-muted hover:disabled:checked:bg-transparent': {},
        },
        '.form-checkbox': {
            '&.outborder-fenalco:checked': {
                '@apply !border-fenalco-green bg-transparent': {},
                backgroundImage: `url("data:image/svg+xml,<svg viewBox='0 0 16 16' fill='%2300CE7C' xmlns='http://www.w3.org/2000/svg'><path d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/></svg>") !important`,
                backgroundSize: '18px 18px !important',
            },
        },
        '.form-radio': {
            '@apply rounded-full': {},
            '&.outborder-fenalco:checked' :{
                '@apply bg-transparent border-fenalco-green': {},
            },
        },
        '.togglebutton input:checked ~ .band' :{
            '@apply bg-fenalco-green': {},
        },
        '.togglebutton input:checked ~ .dot' :{
            '@apply translate-x-full bg-white': {},
        },
        '.togglebutton.out-line input:checked ~ .band' :{
            '@apply bg-transparent border-fenalco-dark': {},
        },
        '.togglebutton.out-line input:checked ~ .dot' :{
            '@apply translate-x-full bg-fenalco-dark': {},
        }
    });
});
