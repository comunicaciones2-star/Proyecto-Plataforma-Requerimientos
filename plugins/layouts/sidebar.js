const plugin = require('tailwindcss/plugin');

module.exports = plugin(function ({ addComponents }) {
    addComponents({
        '.sidebar': {
            '@apply fixed z-[9999] lg:z-[10] flex-none w-[240px] ltr:border-r rtl:border-l dark:bg-darkborder border-black/10 transition-all duration-300 overflow-hidden': {},
            '@apply group-data-[sidebar=dark]/item:bg-darkborder group-data-[sidebar=dark]/item:border-darkborder group-data-[sidebar=brand]/item:border-fenalco-dark': {},

            '&:hover': {
                '.nav-item': {
                    '> a': {
                        '@apply w-auto': {},
                    }
                }
            },

            '.nav-item': {
                '> a': {
                    '@apply flex items-center gap-1 py-1 mb-1 overflow-hidden text-black rounded-md whitespace-nowrap dark:text-white hover:text-fenalco-green last:mb-0 group-data-[sidebar=dark]/item:text-white group-data-[sidebar=brand]/item:text-fenalco-green-light-1': {},
                    '@apply [&.active]:text-fenalco-green group-data-[sidebar=dark]/item:[&.active]:text-fenalco-green group-data-[sidebar=brand]/item:[&.active]:text-fenalco-green': {},
                }
            },

            'ul.sub-menu': {
                'li': {
                    'a': {
                        '@apply flex items-center capitalize relative ltr:pl-7 rtl:pr-7 px-4 py-1 before:transition-all before:duration-300 rounded-lg hover:text-fenalco-green group-data-[sidebar=brand]/item:hover:text-fenalco-green hover:before:h-1.5 hover:before:w-1.5 hover:before:bg-fenalco-green group-data-[sidebar=brand]/item:hover:before:bg-fenalco-green hover:before:absolute hover:before:top-1/2 hover:before:-translate-y-1/2 ltr:hover:before:left-2 rtl:hover:before:right-2 hover:before:rounded-full': {},
                        '@apply [&.active]:text-fenalco-green group-data-[sidebar=brand]/item:[&.active]:text-fenalco-green [&.active]:before:h-1.5 [&.active]:before:w-1.5 [&.active]:before:bg-fenalco-green group-data-[sidebar=brand]/item:[&.active]:before:bg-fenalco-green [&.active]:before:absolute [&.active]:before:top-1/2 [&.active]:before:-translate-y-1/2 [&.active]:ltr:before:left-2 [&.active]:rtl:before:right-2 [&.active]:before:rounded-full': {},
                    }
                }
            },
        },
    });
});
