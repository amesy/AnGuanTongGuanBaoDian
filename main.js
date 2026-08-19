const {
    app,
    BrowserWindow,
    session,
    Menu
} = require('electron');

const path = require('path');

const {
    websiteUrl
} = require('./config');

const ALLOWED_HOST =
    new URL(
        websiteUrl
    ).hostname;

const preloadPath = path.join(__dirname, 'preload.js');

let mainWindow = null;

// ======================================================
// 自动恢复网页
//
// 原则：
// 1. 正常页面绝不主动刷新
// 2. 页面加载失败时自动重试
// 3. Renderer 进程崩溃时自动恢复
// 4. 避免重复 reload
// 5. 不影响正常考试和刷题
// ======================================================

function enableAutoRecovery(win) {

    if (!win || win.isDestroyed()) {
        return;
    }


    let reloadTimer = null;

    let destroyed = false;


    // ==================================================
    // 安排自动重新加载
    // ==================================================

    function scheduleReload(delay = 3000) {

        // 已经安排过一次，就不要重复安排
        if (reloadTimer) {
            return;
        }


        reloadTimer = setTimeout(
            () => {

                reloadTimer = null;


                if (
                    destroyed ||
                    win.isDestroyed()
                ) {

                    return;

                }


                console.log(
                    '网页异常，正在自动重新加载...'
                );


                try {

                    win.webContents.reload();

                } catch (error) {

                    console.log(
                        '自动重新加载失败:',
                        error.message
                    );

                }

            },
            delay
        );

    }


    // ==================================================
    // 清理定时器
    // ==================================================

    function clearReloadTimer() {

        if (reloadTimer) {

            clearTimeout(
                reloadTimer
            );

            reloadTimer = null;

        }

    }


    // ==================================================
    // 页面加载失败
    // ==================================================

    win.webContents.on(
        'did-fail-load',
        (
            event,
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame
        ) => {

            // 只处理主页面
            if (!isMainFrame) {
                return;
            }


            console.log(
                '页面加载失败:',
                errorCode,
                errorDescription,
                validatedURL
            );


            /*
             * 用户主动停止加载等情况不需要疯狂重试。
             *
             * -3 = ERR_ABORTED
             */

            if (
                errorCode === -3
            ) {

                return;

            }


            scheduleReload(3000);

        }
    );


    // ==================================================
    // 页面加载完成
    // ==================================================

    win.webContents.on(
        'did-finish-load',
        () => {

            console.log(
                '网页加载完成:',
                win.getTitle()
            );


            clearReloadTimer();

        }
    );


    // ==================================================
    // Renderer 进程异常
    // ==================================================

    win.webContents.on(
        'render-process-gone',
        (
            event,
            details
        ) => {

            console.log(
                '网页进程异常:',
                details.reason
            );


            /*
             * destroyed / killed / crashed 等情况下
             * 尝试恢复页面。
             */

            scheduleReload(2000);

        }
    );


    // ==================================================
    // 窗口关闭
    // ==================================================

    win.on(
        'closed',
        () => {

            destroyed = true;

            clearReloadTimer();

        }
    );

}


// ======================================================
// 判断是否为本站 URL
// ======================================================

function isAllowedUrl(url) {

    try {

        const parsed = new URL(url);

        return (
            parsed.protocol === 'https:' &&
            parsed.hostname === ALLOWED_HOST
        );

    } catch {

        return false;

    }

}


// ======================================================
// 判断是否为“试卷详情”
// ======================================================

function isPaperDetailUrl(url) {

    try {

        const parsed = new URL(url);

        return (
            parsed.hostname === ALLOWED_HOST &&
            (
                parsed.pathname ===
                '/kaoshi/paper/check/' ||

                parsed.pathname ===
                '/kaoshi/paper/check'
            )
        );

    } catch {

        return false;

    }

}


// ======================================================
// 判断是否为“成绩详情”
//
// 例如：
// /k/385783?code=930385220084920320
//
// code 是动态的，所以只判断 /k/数字
// ======================================================

function isScoreDetailUrl(url) {

    try {

        const parsedUrl = new URL(url);


        if (
            parsedUrl.hostname !==
            ALLOWED_HOST
        ) {

            return false;

        }


        return /^\/k\/\d+\/?$/.test(
            parsedUrl.pathname
        );

    } catch {

        return false;

    }

}


// ======================================================
// 激活窗口
// ======================================================

function focusWindow(win) {

    if (
        !win ||
        win.isDestroyed()
    ) {

        return false;

    }


    if (
        win.isMinimized()
    ) {

        win.restore();

    }


    win.show();
    win.focus();

    return true;

}


// ======================================================
// 创建“试卷详情”窗口
// ======================================================

function createPaperDetailWindow(url) {

    console.log(
        '创建试卷详情窗口:',
        url
    );


    const paperWindow =
        new BrowserWindow({

            width: 1400,
            height: 900,

            minWidth: 1000,
            minHeight: 700,

            title: '试卷详情',

            icon: path.join(
                __dirname,
                'assets',
                'icon.ico'
            ),

            parent: null,

            modal: false,

            frame: true,

            closable: true,

            resizable: true,

            minimizable: true,

            maximizable: true,

            alwaysOnTop: false,

            autoHideMenuBar: true,

            webPreferences: {

                preload: preloadPath,

                contextIsolation: true,

                nodeIntegration: false,

                devTools: false

            }

        });


    // ==================================================
    // 启用自动恢复
    // ==================================================

    enableAutoRecovery(
        paperWindow
    );


    // ==================================================
    // 加载试卷详情
    // ==================================================

    paperWindow.loadURL(url);


    // ==================================================
    // 试卷详情页面打开新窗口
    // ==================================================

    paperWindow.webContents.setWindowOpenHandler(
        ({ url }) => {

            console.log(
                '试卷详情页面打开新窗口:',
                url
            );


            // 试卷详情
            if (
                isPaperDetailUrl(url)
            ) {

                createPaperDetailWindow(url);

                return {
                    action: 'deny'
                };

            }


            // 成绩详情
            if (
                isScoreDetailUrl(url)
            ) {

                createScoreDetailWindow(url);

                return {
                    action: 'deny'
                };

            }


            // 其他本站页面
            if (
                isAllowedUrl(url)
            ) {

                createChildWindow(url);

                return {
                    action: 'deny'
                };

            }


            return {
                action: 'deny'
            };

        }
    );


    // ==================================================
    // 禁止 DevTools
    // ==================================================

    paperWindow.webContents.on(
        'devtools-opened',
        () => {

            paperWindow.webContents.closeDevTools();

        }
    );


    // ==================================================
    // 强制允许关闭试卷详情窗口
    // ==================================================

    paperWindow.on(
        'close',
        (event) => {

            event.preventDefault();


            if (
                !paperWindow.isDestroyed()
            ) {

                paperWindow.destroy();

            }

        }
    );


    // ==================================================
    // 窗口关闭
    // ==================================================

    paperWindow.on(
        'closed',
        () => {

            console.log(
                '试卷详情窗口已关闭'
            );

        }
    );


    return paperWindow;

}


// ======================================================
// 创建“成绩详情”窗口
// ======================================================

function createScoreDetailWindow(url) {

    console.log(
        '创建成绩详情窗口:',
        url
    );


    const scoreDetailWindow =
        new BrowserWindow({

            width: 1400,
            height: 900,

            minWidth: 1000,
            minHeight: 700,

            title: '成绩详情',

            icon: path.join(
                __dirname,
                'assets',
                'icon.ico'
            ),

            parent: null,

            modal: false,

            frame: true,

            closable: true,

            resizable: true,

            minimizable: true,

            maximizable: true,

            alwaysOnTop: false,

            autoHideMenuBar: true,

            webPreferences: {

                preload: preloadPath,

                contextIsolation: true,

                nodeIntegration: false,

                devTools: false

            }

        });


    // ==================================================
    // 启用自动恢复
    // ==================================================

    enableAutoRecovery(
        scoreDetailWindow
    );


    // ==================================================
    // 加载成绩详情
    // ==================================================

    scoreDetailWindow.loadURL(url);


    // ==================================================
    // 成绩详情页面打开新窗口
    // ==================================================

    scoreDetailWindow.webContents.setWindowOpenHandler(
        ({ url }) => {

            console.log(
                '成绩详情页面打开新窗口:',
                url
            );


            // 试卷详情
            if (
                isPaperDetailUrl(url)
            ) {

                createPaperDetailWindow(url);

                return {
                    action: 'deny'
                };

            }


            // 成绩详情
            if (
                isScoreDetailUrl(url)
            ) {

                createScoreDetailWindow(url);

                return {
                    action: 'deny'
                };

            }


            // 其他本站页面
            if (
                isAllowedUrl(url)
            ) {

                createChildWindow(url);

                return {
                    action: 'deny'
                };

            }


            return {
                action: 'deny'
            };

        }
    );


    // ==================================================
    // 禁止 DevTools
    // ==================================================

    scoreDetailWindow.webContents.on(
        'devtools-opened',
        () => {

            scoreDetailWindow.webContents.closeDevTools();

        }
    );


    // ==================================================
    // 强制允许关闭
    // ==================================================

    scoreDetailWindow.on(
        'close',
        (event) => {

            event.preventDefault();


            if (
                !scoreDetailWindow.isDestroyed()
            ) {

                scoreDetailWindow.destroy();

            }

        }
    );


    // ==================================================
    // 窗口关闭
    // ==================================================

    scoreDetailWindow.on(
        'closed',
        () => {

            console.log(
                '成绩详情窗口已关闭'
            );

        }
    );


    return scoreDetailWindow;

}


// ======================================================
// 创建普通子窗口
// ======================================================

function createChildWindow(url) {

    console.log(
        '创建普通子窗口:',
        url
    );


    const childWindow =
        new BrowserWindow({

            width: 1400,
            height: 900,

            minWidth: 1000,
            minHeight: 700,

            title: '安管通关宝典',

            icon: path.join(
                __dirname,
                'assets',
                'icon.ico'
            ),

            parent: null,

            modal: false,

            frame: true,

            closable: true,

            resizable: true,

            minimizable: true,

            maximizable: true,

            alwaysOnTop: false,

            autoHideMenuBar: true,

            webPreferences: {

                preload: preloadPath,

                contextIsolation: true,

                nodeIntegration: false,

                devTools: false

            }

        });


    // ==================================================
    // 启用自动恢复
    // ==================================================

    enableAutoRecovery(
        childWindow
    );


    // ==================================================
    // 加载页面
    // ==================================================

    childWindow.loadURL(url);


    // ==================================================
    // 子窗口打开新窗口
    // ==================================================

    childWindow.webContents.setWindowOpenHandler(
        ({ url }) => {

            console.log(
                '子窗口打开新窗口:',
                url
            );


            // 试卷详情
            if (
                isPaperDetailUrl(url)
            ) {

                createPaperDetailWindow(url);

                return {
                    action: 'deny'
                };

            }


            // 成绩详情
            if (
                isScoreDetailUrl(url)
            ) {

                createScoreDetailWindow(url);

                return {
                    action: 'deny'
                };

            }


            // 其他本站页面
            if (
                isAllowedUrl(url)
            ) {

                createChildWindow(url);

                return {
                    action: 'deny'
                };

            }


            return {
                action: 'deny'
            };

        }
    );


    // ==================================================
    // 禁止 DevTools
    // ==================================================

    childWindow.webContents.on(
        'devtools-opened',
        () => {

            childWindow.webContents.closeDevTools();

        }
    );


    return childWindow;

}


// ======================================================
// 创建主窗口
// ======================================================

async function createMainWindow() {

    // ==================================================
    // 每次启动清除登录状态
    // ==================================================

    await session.defaultSession.clearStorageData({

        storages: [
            'cookies',
            'localstorage',
            'indexdb',
            'serviceworkers',
            'cachestorage'
        ]

    });


    // ==================================================
    // 创建主窗口
    // ==================================================

    mainWindow =
        new BrowserWindow({

            width: 1400,
            height: 900,

            minWidth: 1000,
            minHeight: 700,

            title: '安管通关宝典',

            icon: path.join(
                __dirname,
                'assets',
                'icon.ico'
            ),

            autoHideMenuBar: true,

            webPreferences: {

                preload: preloadPath,

                contextIsolation: true,

                nodeIntegration: false,

                devTools: false

            }

        });


    // ==================================================
    // 启用自动恢复
    // ==================================================

    enableAutoRecovery(
        mainWindow
    );


    // ==================================================
    // 加载登录页面
    // ==================================================

    await mainWindow.loadURL(
        websiteUrl
    );


    // ==================================================
    // 主窗口打开新窗口
    // ==================================================

    mainWindow.webContents.setWindowOpenHandler(
        ({ url }) => {

            console.log(
                '主窗口打开新窗口:',
                url
            );


            // ------------------------------------------
            // 试卷详情
            // ------------------------------------------

            if (
                isPaperDetailUrl(url)
            ) {

                createPaperDetailWindow(url);

                return {
                    action: 'deny'
                };

            }


            // ------------------------------------------
            // 成绩详情
            // ------------------------------------------

            if (
                isScoreDetailUrl(url)
            ) {

                createScoreDetailWindow(url);

                return {
                    action: 'deny'
                };

            }


            // ------------------------------------------
            // 其他本站页面
            // ------------------------------------------

            if (
                isAllowedUrl(url)
            ) {

                createChildWindow(url);

                return {
                    action: 'deny'
                };

            }


            // ------------------------------------------
            // 外部网站禁止
            // ------------------------------------------

            return {
                action: 'deny'
            };

        }
    );


    // ==================================================
    // 禁止 DevTools
    // ==================================================

    mainWindow.webContents.on(
        'devtools-opened',
        () => {

            mainWindow.webContents.closeDevTools();

        }
    );


    // ==================================================
    // 主窗口关闭
    // ==================================================

    mainWindow.on(
        'closed',
        () => {

            mainWindow = null;

        }
    );

}


// ======================================================
// Electron 启动
// ======================================================

app.whenReady().then(
    async () => {

        // ----------------------------------------------
        // 移除 Electron 菜单栏
        // ----------------------------------------------

        Menu.setApplicationMenu(null);


        // ----------------------------------------------
        // 创建主窗口
        // ----------------------------------------------

        await createMainWindow();

    }
);


// ======================================================
// Windows / macOS
// ======================================================

app.on(
    'window-all-closed',
    () => {

        if (
            process.platform !== 'darwin'
        ) {

            app.quit();

        }

    }
);