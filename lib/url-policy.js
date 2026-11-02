'use strict';

function createUrlPolicy(websiteUrl) {
    const base = new URL(websiteUrl);
    if (base.protocol !== 'https:' || base.username || base.password) {
        throw new Error('站点配置必须使用不含用户凭据的 HTTPS 地址');
    }

    function parseAllowedUrl(value) {
        try {
            const url = new URL(value);
            return url.origin === base.origin && !url.username && !url.password ? url : null;
        } catch {
            return null;
        }
    }

    function isAllowedUrl(value) {
        return parseAllowedUrl(value) !== null;
    }

    function getWindowKind(value) {
        const url = parseAllowedUrl(value);
        if (!url) return null;
        if (/^\/kaoshi\/paper\/check\/?$/.test(url.pathname)) return 'paper';
        if (/^\/k\/\d+\/?$/.test(url.pathname)) return 'score';
        return 'child';
    }

    function isLoginUrl(value) {
        const url = parseAllowedUrl(value);
        return url !== null &&
            (url.pathname === '/' || /^\/(login|student)(\/|$)/.test(url.pathname));
    }

    return { isAllowedUrl, isLoginUrl, getWindowKind };
}

module.exports = { createUrlPolicy };
