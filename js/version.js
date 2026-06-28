// Global versioning helper for cache busting
// Update APP_VERSION once per deploy; all local CSS/JS will reload with this stamp.
const APP_VERSION = '1.0.7';

const versionAsset = (url) => {
    if (!url || /^https?:\/\//i.test(url)) return url; // skip external/CDN
    return url.includes('?') ? `${url}&v=${APP_VERSION}` : `${url}?v=${APP_VERSION}`;
};

const stampAssets = () => {
    // Stylesheets
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        const href = link.getAttribute('href');
        const updated = versionAsset(href);
        if (updated && href !== updated) {
            link.setAttribute('href', updated);
        }
    });
    // Scripts (skip this version file itself)
    document.querySelectorAll('script[src]').forEach((script) => {
        const src = script.getAttribute('src');
        if (src && src.includes('version.js')) return;
        const updated = versionAsset(src);
        if (updated && src !== updated) {
            script.setAttribute('src', updated);
        }
    });
};

// Run immediately and once DOM is ready (covers late-injected tags)
stampAssets();
document.addEventListener('DOMContentLoaded', stampAssets);

