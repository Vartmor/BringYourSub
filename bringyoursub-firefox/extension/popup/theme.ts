/**
 * BringYourSub - Theme Management
 * 
 * Handles dark/light theme switching with system preference detection.
 * 
 * @module popup/theme
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

/**
 * Get the current system theme preference
 */
function getSystemTheme(): 'light' | 'dark' {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

/**
 * Apply theme to the document
 */
function applyTheme(theme: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Get the effective theme (resolves 'system' to actual theme)
 */
export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
    if (theme === 'system') {
        return getSystemTheme();
    }
    return theme;
}

/**
 * Initialize theme from storage or system preference
 */
export async function initTheme(): Promise<Theme> {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const savedTheme = result[STORAGE_KEY] as Theme | undefined;
            const theme = savedTheme || 'system';
            applyTheme(getEffectiveTheme(theme));
            resolve(theme);
        });
    });
}

/**
 * Set and save theme preference
 */
export async function setTheme(theme: Theme): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: theme }, () => {
            applyTheme(getEffectiveTheme(theme));
            resolve();
        });
    });
}

/**
 * Toggle between light and dark (skips system)
 */
export async function toggleTheme(): Promise<Theme> {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], async (result) => {
            const currentTheme = result[STORAGE_KEY] as Theme | undefined || 'system';
            const effectiveTheme = getEffectiveTheme(currentTheme);
            const newTheme: Theme = effectiveTheme === 'dark' ? 'light' : 'dark';
            await setTheme(newTheme);
            resolve(newTheme);
        });
    });
}

/**
 * Listen for system theme changes
 */
export function watchSystemTheme(callback: (theme: 'light' | 'dark') => void): void {
    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            // Only react if user has "system" preference
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                const theme = result[STORAGE_KEY] as Theme | undefined;
                if (!theme || theme === 'system') {
                    const newTheme = e.matches ? 'dark' : 'light';
                    applyTheme(newTheme);
                    callback(newTheme);
                }
            });
        };

        // Modern browsers
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else {
            // Fallback for older browsers
            mediaQuery.addListener(handleChange);
        }
    }
}

/**
 * Get current saved theme preference
 */
export async function getCurrentTheme(): Promise<Theme> {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            resolve(result[STORAGE_KEY] as Theme || 'system');
        });
    });
}
