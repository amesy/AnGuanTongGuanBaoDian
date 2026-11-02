(() => {
    'use strict';

    const { ipcRenderer } = require('electron');
    const allowDevTools = process.argv.includes('--agt-devtools');
    const brand = '安管通关宝典';
    const blockedBrandPattern = /考试宝(?:企业版)?[-－—–|｜\s]*可以导入题库的在线组卷刷题学习平台|可以导入题库的在线组卷刷题学习平台|考试宝企业版|考试宝/g;
    const ignoredTextContainers = 'script, style, noscript, textarea, input, [contenteditable]';
    const ignoredAttributeContainers = 'script, style, noscript, textarea, [contenteditable]';
    const relevantContainers = '.footer-top, .forget, .bj-form-item, .el-form-item, a, .logo-tip, .el-tree-node__content';
    let pageReady = false;
    let revealTimer = null;
    let initialRevealTimer = null;
    let cleanTimer = null;
    let observing = false;
    let lastLoginMode = null;
    let loginFailureDetected = false;
    let loginErrors = [];
    const pendingRoots = new Set();

    function findElements(root, selector) {
        if (!root) return [];
        const elements = Array.from(root.querySelectorAll?.(selector) || []);
        if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) elements.unshift(root);
        return elements;
    }

    function hideElement(element) {
        if (element.style.getPropertyValue('display') !== 'none' ||
            element.style.getPropertyPriority('display') !== 'important') {
            element.style.setProperty('display', 'none', 'important');
        }
    }

    function installPageProtection() {
        if (!document.documentElement) return;
        if (!document.getElementById('agt-page-protection-style')) {
            const style = document.createElement('style');
            style.id = 'agt-page-protection-style';
            style.textContent = `
                html.agt-page-loading, body.agt-page-loading {
                    visibility: hidden !important;
                    background: #fff !important;
                }
                #agt-page-shield {
                    position: fixed !important; inset: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    z-index: 2147483647 !important; background: #fff !important;
                    pointer-events: all !important;
                }
                html.agt-login-error-editable .v-modal,
                html.agt-login-error-editable .el-loading-mask,
                html.agt-login-error-editable .el-message-box__wrapper,
                html.agt-login-error-editable .el-dialog__wrapper {
                    pointer-events: none !important;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        }
        if (!pageReady) {
            document.documentElement.classList.add('agt-page-loading');
            document.body?.classList.add('agt-page-loading');
        }
    }

    function showPageShield() {
        if (!document.body || document.getElementById('agt-page-shield')) return;
        const shield = document.createElement('div');
        shield.id = 'agt-page-shield';
        document.body.appendChild(shield);
    }

    function ensureShieldRemoved() {
        if (!pageReady) return;
        document.getElementById('agt-page-shield')?.remove();
        [document.documentElement, document.body].forEach(element => {
            if (element?.classList.contains('agt-page-loading')) {
                element.classList.remove('agt-page-loading');
            }
        });
    }

    function hidePageOptions(root) {
        findElements(root, '.footer-top').forEach(hideElement);
        findElements(root, '.forget').forEach(element => {
            if (/注册账号|忘记密码/.test(element.textContent)) hideElement(element);
        });
        findElements(root, '.bj-form-item, .el-form-item').forEach(element => {
            const label = element.querySelector('.el-form-item__label')?.textContent.trim();
            if (element.matches('.el-form-item') && (label === '手机号码' || label === '修改密码')) {
                hideElement(element);
            }
            if (label === '组织ID' && element.querySelector('input[placeholder="请输入您的组织ID"]')) {
                hideElement(element);
                const tip = element.parentElement?.querySelector('p');
                if (tip?.textContent.includes('不知道什么是组织ID')) hideElement(tip);
            }
        });
        findElements(root, 'a').forEach(link => {
            if (['/score/', '/notice/', '/contact/'].includes(link.getAttribute('href')) ||
                /我的积分|公告通知|联系我们/.test(link.textContent)) hideElement(link);
        });
        findElements(root, '.logo-tip').forEach(element => {
            if (element.textContent.trim() === '学员专用') hideElement(element);
        });
        findElements(root, '.custom-tree-label').forEach(element => {
            if (element.textContent.trim() === '未分类') {
                const treeNode = element.closest('.el-tree-node__content');
                if (treeNode) hideElement(treeNode);
            }
        });
    }

    function replaceBrandText(value) {
        return value.replace(blockedBrandPattern, match => match.includes('考试宝') ? brand : '');
    }

    function cleanHeadBranding() {
        if (!document.head) return;
        let titles = findElements(document.head, 'title');
        if (titles.length === 0) {
            const title = document.createElement('title');
            document.head.appendChild(title);
            titles = [title];
        }
        titles.forEach(title => {
            if (title.textContent !== brand) title.textContent = brand;
        });
        findElements(document.head,
            'meta[name="description"], meta[name="keywords"], meta[name="application-name"], ' +
            'meta[property="og:title"], meta[property="og:description"], ' +
            'meta[name="twitter:title"], meta[name="twitter:description"]').forEach(meta => {
            const value = meta.getAttribute('content');
            if (value !== null) {
                const next = replaceBrandText(value);
                if (next !== value) meta.setAttribute('content', next);
            }
        });
    }

    function replaceTextNodes(root) {
        while (root?.parentElement && /^(SPAN|B|STRONG|I|EM|SMALL)$/.test(root.tagName)) {
            root = root.parentElement;
        }
        if (!root || root.closest?.(ignoredTextContainers)) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const segments = [];
        const text = [];
        let length = 0;
        let node;
        while ((node = walker.nextNode())) {
            if (node.parentElement?.closest(ignoredTextContainers)) {
                text.push('\0');
                length += 1;
                continue;
            }
            segments.push({ node, start: length, end: length + node.nodeValue.length });
            text.push(node.nodeValue);
            length += node.nodeValue.length;
        }
        // 按合并文本定位，但只改写原文本节点，可处理被 span 等标签拆开的品牌词。
        const edits = [];
        let cursor = 0;
        for (const match of text.join('').matchAll(blockedBrandPattern)) {
            const end = match.index + match[0].length;
            while (segments[cursor].end <= match.index) cursor += 1;
            const first = cursor;
            while (segments[cursor].end < end) cursor += 1;
            edits.push({ first, last: cursor, start: match.index - segments[first].start,
                end: end - segments[cursor].start, value: match[0].includes('考试宝') ? brand : '' });
        }
        for (const edit of edits.reverse()) {
            const first = segments[edit.first].node;
            const last = segments[edit.last].node;
            if (first === last) {
                first.nodeValue = first.nodeValue.slice(0, edit.start) + edit.value + first.nodeValue.slice(edit.end);
            } else {
                first.nodeValue = first.nodeValue.slice(0, edit.start) + edit.value;
                for (let index = edit.first + 1; index < edit.last; index++) segments[index].node.nodeValue = '';
                last.nodeValue = last.nodeValue.slice(edit.end);
            }
        }
    }

    function replaceAttributes(root) {
        findElements(root, '[title], [placeholder], [aria-label], [alt]').forEach(element => {
            if (element.closest(ignoredAttributeContainers)) return;
            for (const attribute of ['title', 'placeholder', 'aria-label', 'alt']) {
                const value = element.getAttribute(attribute);
                if (value !== null) {
                    const next = replaceBrandText(value);
                    if (next !== value) element.setAttribute(attribute, next);
                }
            }
        });
        // 不改写 input/textarea.value，也不替换可编辑内容，保留网页的数据绑定。
    }

    function isLoginPage() {
        const pathname = window.location.pathname;
        return (pathname === '/' || /\/(login|student)(\/|$)/.test(pathname)) &&
            document.querySelector('input[type="password"]') !== null;
    }

    function getLoginInputs() {
        if (!isLoginPage()) return [];
        const password = document.querySelector('input[type="password"]');
        const form = password.closest('form, .el-form, .login-form') || document;
        return findElements(form, 'input[type="text"], input[type="password"]')
            .filter(input => !input.placeholder.includes('组织ID'));
    }

    function isLoginElementVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' &&
            element.getClientRects().length > 0;
    }

    function hasActiveLoginDialog() {
        return findElements(document, '.el-message-box__wrapper, .el-dialog__wrapper, dialog[open]')
            .some(wrapper => {
                const dialog = wrapper.matches('dialog') ? wrapper :
                    wrapper.querySelector('.el-message-box, .el-dialog');
                return dialog && isLoginElementVisible(wrapper) && isLoginElementVisible(dialog);
            });
    }

    function updateLoginRecovery() {
        if (!isLoginPage()) {
            loginFailureDetected = false;
            loginErrors = [];
            if (document.documentElement?.classList.contains('agt-login-error-editable')) {
                document.documentElement.classList.remove('agt-login-error-editable');
            }
            return;
        }
        const errors = findElements(document,
            '.el-message--error, .el-notification.error, .el-alert--error, ' +
            '.el-form-item__error, .el-message-box__message')
            .filter(isLoginElementVisible)
            .map(element => ({ element, text: element.textContent }));
        if (errors.some(error => !loginErrors.some(previous =>
            previous.element === error.element && previous.text === error.text))) {
            loginFailureDetected = true;
        }
        loginErrors = errors;
        const canEdit = loginFailureDetected && !hasActiveLoginDialog();
        if (document.documentElement.classList.contains('agt-login-error-editable') !== canEdit) {
            document.documentElement.classList.toggle('agt-login-error-editable', canEdit);
        }
        if (canEdit) {
            ensureShieldRemoved();
            getLoginInputs().forEach(input => {
                if (input.disabled) input.disabled = false;
                if (input.readOnly) input.readOnly = false;
            });
        }
    }

    function resetLoginRecovery() {
        if (!isLoginPage()) return;
        loginFailureDetected = false;
        if (document.documentElement.classList.contains('agt-login-error-editable')) {
            document.documentElement.classList.remove('agt-login-error-editable');
        }
    }

    function restoreLoginKeyboardFocus(event) {
        if (!event.isTrusted || (event.type === 'pointerdown' && event.button !== 0) ||
            !getLoginInputs().includes(event.target) || hasActiveLoginDialog()) return;
        updateLoginRecovery();
        if (!document.hasFocus()) ipcRenderer.send('agt:restore-login-focus');
    }

    function cleanPage(root = document.body) {
        ensureShieldRemoved();
        hidePageOptions(root);
        cleanHeadBranding();
        replaceTextNodes(root);
        replaceAttributes(root);
    }

    const observerOptions = {
        childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['class', 'style', 'disabled', 'readonly', 'hidden',
            'title', 'placeholder', 'aria-label', 'alt', 'href']
    };
    const observer = new MutationObserver(records => {
        withObserverPaused(updateLoginRecovery);
        const modeChanged = lastLoginMode !== isLoginPage();
        lastLoginMode = isLoginPage();
        if (modeChanged) queueRoot(document.body);
        else records.forEach(record => {
            if (record.type === 'childList') {
                record.addedNodes.forEach(queueRoot);
                const container = record.target.closest?.(relevantContainers);
                if (container) queueRoot(container);
            } else {
                queueRoot(record.target);
            }
        });
        // 品牌文字在本轮 DOM 变化后立即处理，不等待普通页面清理的合并定时器。
        withObserverPaused(() => {
            const roots = Array.from(pendingRoots).filter(root => root?.isConnected);
            roots.filter(root => !roots.some(other => other !== root && other.contains(root)))
                .forEach(root => {
                    replaceTextNodes(root);
                    replaceAttributes(root);
                });
        });
        scheduleClean();
    });

    function withObserverPaused(action) {
        if (observing) observer.disconnect();
        try {
            action();
        } catch (error) {
            console.error('页面处理失败:', error.message);
        } finally {
            if (observing) observer.observe(document.documentElement, observerOptions);
        }
    }

    function queueRoot(node) {
        if (!node) return;
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (!element || !element.isConnected) return;
        const root = element.closest(relevantContainers) || element;
        if (pendingRoots.size > 32 || root === document.documentElement) {
            pendingRoots.clear();
            pendingRoots.add(document.body);
        } else {
            pendingRoots.add(root);
        }
    }

    function scheduleClean() {
        if (!observing || cleanTimer !== null || document.hidden || pendingRoots.size === 0) return;
        cleanTimer = setTimeout(() => {
            cleanTimer = null;
            // 合并父子区域；处理自身 DOM 写入时暂停监听，避免重复触发。
            const roots = Array.from(pendingRoots).filter(root => root?.isConnected);
            pendingRoots.clear();
            withObserverPaused(() => {
                roots.filter(root => !roots.some(other => other !== root && other.contains(root)))
                    .forEach(root => cleanPage(root));
                updateLoginRecovery();
            });
        }, 32);
    }

    function handleRouteChange() {
        withObserverPaused(() => {
            updateLoginRecovery();
            lastLoginMode = isLoginPage();
        });
        queueRoot(document.body);
        scheduleClean();
    }

    function revealPage() {
        if (pageReady) return;
        try {
            withObserverPaused(() => cleanPage());
        } finally {
            pageReady = true;
            clearTimeout(revealTimer);
            clearTimeout(initialRevealTimer);
            withObserverPaused(() => {
                ensureShieldRemoved();
                updateLoginRecovery();
            });
        }
    }

    function resumePage() {
        titleObserver.observe(document, titleObserverOptions);
        cleanHeadBranding();
        if (observing || !document.documentElement) return;
        observing = true;
        observer.observe(document.documentElement, observerOptions);
        handleRouteChange();
    }

    function initializePage() {
        installPageProtection();
        showPageShield();
        withObserverPaused(() => cleanPage());
        resumePage();
        initialRevealTimer = setTimeout(() => {
            requestAnimationFrame(() => requestAnimationFrame(revealPage));
        }, 80);
        // 隐藏窗口或页面处理异常时也有显示兜底，不会一直停留在白屏。
        revealTimer = setTimeout(revealPage, 1000);
    }

    const titleObserverOptions = {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['content']
    };
    const titleObserver = new MutationObserver(records => {
        if (!pageReady || !document.getElementById('agt-page-protection-style')) installPageProtection();
        if (records.some(record => {
            const element = record.target.nodeType === Node.ELEMENT_NODE ?
                record.target : record.target.parentElement;
            return record.target === document || !document.head || element === document.documentElement ||
                element === document.head || element?.closest('head');
        })) cleanHeadBranding();
    });
    // 直接监听 document，可在 html/head 尚未创建时开始，覆盖初次解析和 head 替换。
    titleObserver.observe(document, titleObserverOptions);
    cleanHeadBranding();
    installPageProtection();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePage, { once: true });
    } else {
        initializePage();
    }
    window.addEventListener('pagehide', () => {
        observing = false;
        observer.disconnect();
        titleObserver.disconnect();
        clearTimeout(cleanTimer);
        cleanTimer = null;
        pendingRoots.clear();
    });
    window.addEventListener('pageshow', resumePage);
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    ipcRenderer.on('agt:page-navigation', handleRouteChange);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) scheduleClean();
    });
    document.addEventListener('pointerdown', restoreLoginKeyboardFocus, true);
    document.addEventListener('keydown', restoreLoginKeyboardFocus, true);
    document.addEventListener('submit', event => {
        if (getLoginInputs().some(input => event.target.contains(input))) resetLoginRecovery();
    }, true);
    document.addEventListener('click', event => {
        const button = event.target.closest?.('button, input[type="submit"], [role="button"]');
        if (button && !button.closest('.el-message-box__wrapper, .el-dialog__wrapper, dialog') &&
            (button.type === 'submit' || /登\s*录|log\s*in/i.test(button.textContent))) resetLoginRecovery();
    }, true);
    document.addEventListener('contextmenu', event => {
        event.preventDefault();
        event.stopPropagation();
    }, true);
    document.addEventListener('keydown', event => {
        const key = event.key.toLowerCase();
        if (!allowDevTools && (key === 'f12' ||
            (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
            (event.ctrlKey && key === 'u'))) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
})();
