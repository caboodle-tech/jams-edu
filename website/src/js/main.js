// @jamsedu --format=iife --dest=js/main.js
document.addEventListener('DOMContentLoaded', () => {

    const getOSColorMode = () => {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    };

    const setupThemeButtons = () => {
        const themeOptions = document.getElementById('theme-options');
        if (!themeOptions) {
            console.warn('Theme switcher not found!');
            return;
        }

        const themeSelector = document.getElementById('theme-selector-button');
        themeSelector.addEventListener('click', () => {
            themeOptions.classList.toggle('open');
        });

        const defaultButton = document.getElementById('default-theme-button');
        defaultButton.addEventListener('click', () => {
            localStorage.removeItem('theme');
            themeOptions.classList.remove('open');
            setWebsiteColorMode();
        });

        const lightButton = document.getElementById('light-theme-button');
        lightButton.addEventListener('click', () => {
            localStorage.setItem('theme', 'light');
            themeOptions.classList.remove('open');
            setWebsiteColorMode();
        });

        const darkButton = document.getElementById('dark-theme-button');
        darkButton.addEventListener('click', () => {
            localStorage.setItem('theme', 'dark');
            themeOptions.classList.remove('open');
            setWebsiteColorMode();
        });
    };

    const setWebsiteColorMode = () => {
        const savedTheme = localStorage.getItem('theme');
        const theme = savedTheme ? savedTheme : `${getOSColorMode()} default`;
        document.body.setAttribute('class', theme);
    };

    setWebsiteColorMode();
    setupThemeButtons();
});
