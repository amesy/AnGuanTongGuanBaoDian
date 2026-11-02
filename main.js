'use strict';

const { app, BrowserWindow, session, Menu, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { websiteUrl } = require('./config');
const { createUrlPolicy } = require('./lib/url-policy');
const { createWindowController } = require('./lib/window-controller');
const { installLoginFocusRecovery } = require('./lib/login-focus');

const allowDevTools = !app.isPackaged && process.argv.includes('--agt-devtools');

app.whenReady().then(async () => {
    const policy = createUrlPolicy(websiteUrl);
    const controller = createWindowController({
        BrowserWindow, policy, allowDevTools,
        preloadPath: path.join(__dirname, 'preload.js'),
        iconPath: path.join(__dirname, 'assets', 'icon.ico')
    });
    installLoginFocusRecovery({ ipcMain, BrowserWindow, policy });
    Menu.setApplicationMenu(null);
    // 保持原有规则：每次启动都清除登录状态。
    await session.defaultSession.clearStorageData({
        storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
    });
    controller.createWindow(websiteUrl, 'main');
}).catch(error => {
    console.error('应用初始化失败:', error);
    dialog.showErrorBox('安管通关宝典', '应用初始化失败，请关闭后重新启动。');
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
