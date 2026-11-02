'use strict';

function createWindowController({
    BrowserWindow, policy, preloadPath, iconPath, allowDevTools = false,
    setTimer = setTimeout, clearTimer = clearTimeout, logger = console
}) {
    const windows = new Set();
    const titles = { main: '安管通关宝典', child: '安管通关宝典', paper: '试卷详情', score: '成绩详情' };

    function createWindow(url, kind = policy.getWindowKind(url)) {
        if (!policy.isAllowedUrl(url) || !Object.hasOwn(titles, kind)) {
            throw new Error('不允许打开该页面');
        }

        const win = new BrowserWindow({
            width: 1400, height: 900, minWidth: 1000, minHeight: 700,
            title: titles[kind], icon: iconPath,
            parent: null, modal: false, frame: true, closable: true,
            resizable: true, minimizable: true, maximizable: true, alwaysOnTop: false,
            autoHideMenuBar: true,
            webPreferences: {
                preload: preloadPath, contextIsolation: true, nodeIntegration: false,
                sandbox: true, devTools: allowDevTools, spellcheck: false,
                additionalArguments: allowDevTools ? ['--agt-devtools'] : []
            }
        });
        windows.add(win);

        // 必须在 loadURL 前阻止网页标题接管窗口，避免先显示原站标题再替换。
        win.on('page-title-updated', event => event.preventDefault());

        let recoveryTimer = null;
        let retryCount = 0;
        let closed = false;
        let loadFailed = false;
        const isAlive = () => !closed && !win.isDestroyed() && !win.webContents.isDestroyed();

        function cancelRecovery() {
            if (recoveryTimer !== null) {
                clearTimer(recoveryTimer);
                recoveryTimer = null;
            }
        }

        function scheduleRecovery(baseDelay = 3000) {
            if (!isAlive() || recoveryTimer !== null) return;
            const delay = Math.min(baseDelay * (2 ** Math.min(retryCount, 4)), 30000);
            retryCount += 1;
            recoveryTimer = setTimer(() => {
                recoveryTimer = null;
                if (!isAlive()) return;
                try {
                    win.webContents.reload();
                } catch (error) {
                    logger.error('页面恢复失败，将稍后重试:', error.message);
                    scheduleRecovery();
                }
            }, delay);
        }

        const guardNavigation = (event, targetUrl, _isInPlace, isMainFrame) => {
            if (isMainFrame !== false && !policy.isAllowedUrl(targetUrl)) event.preventDefault();
        };
        win.webContents.on('will-navigate', guardNavigation);
        win.webContents.on('will-redirect', guardNavigation);
        win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
            if (isAlive() && policy.isAllowedUrl(targetUrl)) {
                try {
                    createWindow(targetUrl);
                } catch (error) {
                    logger.error('无法创建页面窗口:', error.message);
                }
            }
            return { action: 'deny' };
        });

        win.webContents.on('did-fail-load', (_event, code, _description, targetUrl, isMainFrame) => {
            if (isMainFrame && code !== -3 && policy.isAllowedUrl(targetUrl)) {
                loadFailed = true;
                scheduleRecovery();
            }
        });
        win.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
            // 用户已开始新的主页面导航，旧重试不应打断它。
            if (isMainFrame && !isInPlace) {
                loadFailed = false;
                cancelRecovery();
            }
        });
        win.webContents.on('did-finish-load', () => {
            if (!isAlive() || loadFailed || !policy.isAllowedUrl(win.webContents.getURL())) return;
            cancelRecovery();
            retryCount = 0;
            if (allowDevTools && kind === 'main' && !win.webContents.isDevToolsOpened()) {
                win.webContents.openDevTools();
            }
        });
        win.webContents.on('render-process-gone', () => scheduleRecovery(2000));
        win.webContents.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
            if (isMainFrame && isAlive()) win.webContents.send('agt:page-navigation');
        });
        if (!allowDevTools) {
            win.webContents.on('devtools-opened', () => {
                if (isAlive()) win.webContents.closeDevTools();
            });
        }

        if (kind === 'paper' || kind === 'score') {
            win.on('close', event => {
                event.preventDefault();
                if (!win.isDestroyed()) win.destroy();
            });
        }
        win.on('closed', () => {
            closed = true;
            cancelRecovery();
            windows.delete(win);
        });

        // 所有窗口先安装处理器再加载；失败的 Promise 不会中断初始化。
        try {
            Promise.resolve(win.loadURL(url)).catch(error => {
                if (error.code !== 'ERR_ABORTED' && error.errno !== -3) scheduleRecovery();
            });
        } catch (error) {
            logger.error('页面加载失败，将自动重试:', error.message);
            scheduleRecovery();
        }
        return win;
    }

    return { createWindow };
}

module.exports = { createWindowController };
