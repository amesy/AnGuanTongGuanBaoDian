'use strict';

function installLoginFocusRecovery({ ipcMain, BrowserWindow, policy }) {
    ipcMain.on('agt:restore-login-focus', event => {
        const sender = event.sender;
        if (sender.isDestroyed() || !event.senderFrame ||
            event.senderFrame !== sender.mainFrame || !policy.isLoginUrl(event.senderFrame.url)) {
            return;
        }

        const win = BrowserWindow.fromWebContents(sender);
        if (!win || win.isDestroyed() || !win.isVisible() ||
            win.isMinimized() || !win.isFocused() || !win.isEnabled()) {
            return;
        }

        // 原生提示框可能使 Windows 窗口和 Chromium 的焦点状态不一致。
        win.blur();
        if (!win.isDestroyed() && !sender.isDestroyed()) {
            win.focus();
            sender.focus();
        }
    });
}

module.exports = { installLoginFocusRecovery };
