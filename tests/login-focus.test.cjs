const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');

const { createUrlPolicy } = require('../lib/url-policy');
const { installLoginFocusRecovery } = require('../lib/login-focus');

function createFixture() {
    const ipcMain = new EventEmitter();
    const calls = [];
    const frame = { url: require('../config').websiteUrl };
    const sender = {
        mainFrame: frame,
        isDestroyed: () => false,
        focus: () => calls.push('contents.focus')
    };
    const win = {
        isDestroyed: () => false,
        isVisible: () => true,
        isMinimized: () => false,
        isFocused: () => true,
        isEnabled: () => true,
        blur: () => calls.push('window.blur'),
        focus: () => calls.push('window.focus')
    };
    installLoginFocusRecovery({
        ipcMain,
        BrowserWindow: { fromWebContents: () => win },
        policy: createUrlPolicy(require('../config').websiteUrl)
    });
    return { ipcMain, frame, sender, win, calls,
        send: event => ipcMain.emit('agt:restore-login-focus', event || { sender, senderFrame: frame }) };
}

test('restores native window and web contents focus in order', () => {
    const fixture = createFixture();
    fixture.send();
    assert.deepEqual(fixture.calls, ['window.blur', 'window.focus', 'contents.focus']);
});

test('rejects subframes and detached frames', () => {
    const fixture = createFixture();
    fixture.send({ sender: fixture.sender, senderFrame: { ...fixture.frame } });
    fixture.send({ sender: fixture.sender, senderFrame: null });
    assert.deepEqual(fixture.calls, []);
});

test('rejects external origins, HTTP, other ports and business pages', () => {
    for (const url of ['https://example.com/login', 'http://s.kaoshibao.com/login',
        'https://s.kaoshibao.com:8443/login', 'https://s.kaoshibao.com/kaoshi/paper/check',
        'https://s.kaoshibao.com/student-evil', 'invalid']) {
        const fixture = createFixture();
        fixture.frame.url = url;
        fixture.send();
        assert.deepEqual(fixture.calls, [], url);
    }
});

test('does not activate background, hidden, disabled, minimized or destroyed windows', () => {
    for (const [method, value] of [['isFocused', false], ['isVisible', false],
        ['isEnabled', false], ['isMinimized', true], ['isDestroyed', true]]) {
        const fixture = createFixture();
        fixture.win[method] = () => value;
        fixture.send();
        assert.deepEqual(fixture.calls, [], method);
    }
    const fixture = createFixture();
    fixture.sender.isDestroyed = () => true;
    fixture.send();
    assert.deepEqual(fixture.calls, []);
});
