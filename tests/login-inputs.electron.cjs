const { app, BrowserWindow, session, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const root = path.join(__dirname, '..');
const profile = path.resolve(process.argv[2]);
app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('in-process-gpu');
// This hidden fixture loads only local test HTML; production window settings are unchanged.
app.commandLine.appendSwitch('no-sandbox');
app.on('child-process-gone', (_event, details) => console.error('Test child process exited:', details));

const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<form class="el-form" onsubmit="event.preventDefault()">
<div class="el-form-item"><input id="username" type="text" value="wrong-user"></div>
<div class="el-form-item"><input id="password" type="password" value="wrong-password"></div>
<button id="login" type="submit">Login</button></form>
<script>
window.inputEvents = [];
document.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
    window.inputEvents.push({id: input.id, value: input.value});
}));
window.lockInputs = () => document.querySelectorAll('input').forEach(input => {
    input.disabled = true; input.readOnly = true;
});
window.showError = () => {
    lockInputs();
    document.querySelectorAll('.el-message--error').forEach(node => node.remove());
    const error = document.createElement('div');
    error.className = 'el-message el-message--error';
    error.textContent = 'Incorrect username or password';
    document.body.appendChild(error);
};
</script></body></html>`;

let win;
let server;
const watchdog = setTimeout(() => {
    console.error('Login regression timed out');
    app.exit(1);
}, 25000);
let focusRequests = 0;
ipcMain.on('agt:restore-login-focus', () => focusRequests++);

app.whenReady().then(async () => {
    const ses = session.fromPartition('login-regression');
    ses.setSpellCheckerEnabled(false);
    server = http.createServer((_request, response) => {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(html);
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    win = new BrowserWindow({
        show: false,
        webPreferences: {
            session: ses,
            preload: process.argv[3] || path.join(root, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false
        }
    });
    const preloadErrors = [];
    win.webContents.on('preload-error', (_event, _path, error) => preloadErrors.push(error.message));
    win.webContents.on('console-message', event => {
        if (event.level === 'error') console.error('Renderer:', event.message);
    });
    const evaluate = script => win.webContents.executeJavaScript(script);
    win.webContents.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
        if (isMainFrame) win.webContents.send('agt:page-navigation');
    });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/student/113103`);
    // Wait for the existing initial reveal; recovery assertions below use no delay.
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.deepEqual(preloadErrors, []);
    win.webContents.debugger.attach('1.3');
    const command = (method, params) => win.webContents.debugger.sendCommand(method, params);

    await evaluate(`lockInputs(); const loading = document.createElement('div');
        loading.className = 'el-loading-mask'; loading.id = 'loading';
        loading.style.cssText = 'position:fixed;inset:0;pointer-events:auto';
        document.body.appendChild(loading);`);
    assert.equal(await evaluate('document.querySelector("#username").disabled'), true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#loading")).pointerEvents'), 'auto');
    console.log('PASS: in-flight login remains locked until an error is reported');

    await evaluate('showError()');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('input')).map(i =>
        ({disabled:i.disabled, readOnly:i.readOnly, value:i.value}))`), [
        { disabled: false, readOnly: false, value: 'wrong-user' },
        { disabled: false, readOnly: false, value: 'wrong-password' }
    ]);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#loading")).pointerEvents'), 'none');

    for (const id of ['username', 'password']) {
        await evaluate(`{ const input = document.getElementById('${id}');
            input.focus(); input.select(); }`);
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace',
            code: 'Backspace', windowsVirtualKeyCode: 8 });
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace',
            code: 'Backspace', windowsVirtualKeyCode: 8 });
        assert.equal(await evaluate(`document.getElementById('${id}').value`), '');
        await command('Input.insertText', { text: 'corrected-' + id });
        assert.equal(await evaluate(`document.getElementById('${id}').value`), 'corrected-' + id);
    }
    assert.equal(await evaluate('inputEvents.length >= 4'), true);
    console.log('PASS: username and password can be deleted and re-entered immediately, with input events');

    await evaluate('document.querySelector("#login").click(); lockInputs()');
    assert.equal(await evaluate('document.querySelector("#username").disabled'), true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#loading")).pointerEvents'), 'auto');
    await evaluate('showError()');
    assert.equal(await evaluate('document.querySelector("#username").disabled'), false);
    await evaluate(`document.querySelector('#login').click(); lockInputs();
        document.querySelector('.el-message--error').textContent = 'Incorrect username';`);
    assert.equal(await evaluate('document.querySelector("#username").disabled'), false);
    console.log('PASS: a second attempt preserves loading and a second failure restores editing');

    await evaluate(`document.querySelector('#login').click(); lockInputs();
        const backdrop = document.createElement('div');
        backdrop.className = 'v-modal'; backdrop.id = 'backdrop';
        backdrop.style.cssText = 'position:fixed;inset:0;pointer-events:auto';
        document.body.appendChild(backdrop);
        const dialog = document.createElement('div');
        dialog.className = 'el-message-box__wrapper'; dialog.id = 'error-dialog';
        dialog.innerHTML = '<div class="el-message-box"><div class="el-message-box__message">Wrong password</div><button id="dismiss">OK</button></div>';
        dialog.querySelector('#dismiss').onclick = () => dialog.replaceChildren();
        document.body.appendChild(dialog);`);
    assert.equal(await evaluate('document.querySelector("#username").disabled'), true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#backdrop")).pointerEvents'), 'auto');
    assert.equal(await evaluate('!!document.querySelector("#error-dialog")'), true);
    await evaluate('document.querySelector("#dismiss").click()');
    assert.equal(await evaluate('document.querySelector("#username").disabled'), false);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#backdrop")).pointerEvents'), 'none');
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#error-dialog")).pointerEvents'), 'none');
    assert.equal(await evaluate('!!document.querySelector("#backdrop")'), true);
    console.log('PASS: active dialogs remain intact; closing them immediately releases residual backdrops');

    await evaluate(`document.querySelector('#username').outerHTML =
        '<input id="username" type="text" value="rerendered" disabled readonly>'`);
    assert.equal(await evaluate('document.querySelector("#username").disabled'), false);
    assert.equal(await evaluate(`Object.hasOwn(document.querySelector('#username'), 'setAttribute') ||
        Object.hasOwn(document.querySelector('#username'), 'disabled')`), false);
    await evaluate(`document.querySelector('#username').focus();
        document.querySelector('#username').setSelectionRange(2, 4);
        document.querySelector('#username').disabled = true;`);
    assert.deepEqual(await evaluate(`(() => { const input = document.querySelector('#username');
        return [input.value, input.selectionStart, input.selectionEnd]; })()`), ['rerendered', 2, 4]);
    console.log('PASS: rerendered fields recover without overriding DOM methods or properties');

    const before = focusRequests;
    await evaluate(`document.querySelector('#username').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}))`);
    assert.equal(focusRequests, before);
    await evaluate(`history.pushState({}, '', '/kaoshi/paper/check/'); lockInputs();
        document.querySelector('#loading').style.pointerEvents = 'auto';`);
    assert.equal(await evaluate('document.querySelector("#username").disabled'), true);
    assert.equal(await evaluate('document.documentElement.classList.contains("agt-login-error-editable")'), false);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#loading")).pointerEvents'), 'auto');
    console.log('PASS: synthetic events cannot request native focus; business pages keep their disabled fields and overlays');

    await evaluate(`document.querySelector('form').remove();
        document.body.insertAdjacentHTML('beforeend',
            '<div id="business-brand">考试宝企业版</div>' +
            '<div class="footer-top" id="footer">copyright</div>' +
            '<div class="el-form-item" id="phone-row"><label class="el-form-item__label">手机号码</label><input disabled></div>' +
            '<input id="answer" title="考试宝" value="考试宝">' +
            '<textarea id="answer-area">考试宝</textarea>' +
            '<div contenteditable="true" id="editable">考试宝</div>' +
            '<script id="script-source" type="text/plain">考试宝</script>');`);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(await evaluate('document.querySelector("#business-brand").textContent'), '安管通关宝典');
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#footer")).display'), 'none');
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#phone-row")).display'), 'none');
    assert.equal(await evaluate('document.querySelector("#phone-row input").disabled'), true);
    assert.deepEqual(await evaluate(`['answer', 'answer-area'].map(id => document.getElementById(id).value)`), ['考试宝', '考试宝']);
    assert.equal(await evaluate('document.querySelector("#editable").textContent'), '考试宝');
    assert.equal(await evaluate('document.querySelector("#script-source").textContent'), '考试宝');
    assert.equal(await evaluate('document.querySelector("#answer").title'), '安管通关宝典');
    console.log('PASS: SPA business pages apply branding and hidden options without changing answers, editable content or disabled fields');

    const isolated = code => win.webContents.executeJavaScriptInIsolatedWorld(999, [{ code }]);
    await isolated(`globalThis.__scans = []; const originalWalker = document.createTreeWalker;
        document.createTreeWalker = function(...args) {
            globalThis.__scans.push(args[0].id || args[0].nodeName);
            return originalWalker.apply(this, args);
        }; void 0;`);
    await evaluate(`const changed = document.createElement('div'); changed.id = 'changed-region';
        changed.textContent = '考试宝'; document.body.appendChild(changed);`);
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(await evaluate('document.querySelector("#changed-region").textContent'), '安管通关宝典');
    const scans = await isolated('globalThis.__scans.slice()');
    assert.equal(scans.includes('BODY'), false);
    assert.equal(scans.includes('changed-region'), true);
    const scanCount = scans.length;
    await new Promise(resolve => setTimeout(resolve, 2100));
    assert.equal(await isolated('globalThis.__scans.length'), scanCount);
    console.log('PASS: DOM cleanup visits changed regions and performs no periodic full-page scan');

    await evaluate(`history.pushState({}, '', '/student/113103');
        document.body.insertAdjacentHTML('beforeend', '<form class="el-form" onsubmit="event.preventDefault()">' +
            '<input id="username" type="text" value="retry"><input id="password" type="password" value="wrong">' +
            '<button id="login" type="submit">Login</button></form>');
        showError();`);
    assert.equal(await evaluate('document.querySelector("#password").disabled'), false);
    await evaluate(`window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted:true}));
        lockInputs(); showError();`);
    assert.equal(await evaluate('document.querySelector("#password").disabled'), true);
    await evaluate(`window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true}))`);
    assert.equal(await evaluate('document.querySelector("#password").disabled'), false);
    console.log('PASS: login recovery resumes after SPA return and cached page restoration');

    assert.equal(await evaluate(`(() => { const event = new KeyboardEvent('keydown', {key:'F12', cancelable:true});
        document.dispatchEvent(event); return event.defaultPrevented; })()`), true);

    clearTimeout(watchdog);
    win.destroy();
    server.close();
    app.exit(0);
}).catch(error => {
    clearTimeout(watchdog);
    console.error(error);
    win?.destroy();
    server?.close();
    app.exit(1);
});
