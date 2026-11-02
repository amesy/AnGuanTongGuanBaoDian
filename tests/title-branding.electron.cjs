'use strict';

const { app, BrowserWindow, session } = require('electron');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { once } = require('node:events');

const profile = path.resolve(process.argv[2]);
const preload = path.resolve(process.argv[3]);
const { createWindowController } = require(path.join(path.dirname(preload), 'lib', 'window-controller'));
const brand = '安管通关宝典';
const tagline = '可以导入题库的在线组卷刷题学习平台';
const originalTitle = '考试宝-' + tagline;
const forbidden = /考试宝|可以导入题库的在线组卷刷题学习平台/;
const windows = [];
const titleEvents = [];
const nativeTitles = [];
const preloadErrors = [];
let server;

app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('in-process-gpu');
// Only local HTML is loaded by these hidden test windows.
app.commandLine.appendSwitch('no-sandbox');
const watchdog = setTimeout(() => {
    console.error('Branding regression timed out');
    app.exit(1);
}, 25000);

function html(login) {
    return `<!doctype html><html><head><meta charset="utf-8">
        <title>${originalTitle}</title><meta name="description" content="${originalTitle}">
        </head><body>
        <div id="brand-text" data-branding>${originalTitle}</div>
        <div id="split-text" data-branding><span>考试</span><b>宝</b><i>${tagline.slice(0, 8)}</i><span>${tagline.slice(8)}</span></div>
        <a id="brand-link" title="${originalTitle}" aria-label="考试宝">link</a>
        ${login ? '<form class="el-form"><input id="username" type="text" value="unchanged-account"><input id="password" type="password" value="unchanged-password"></form>' : ''}
        <script>
        window.frameSamples = [];
        function sample() {
            frameSamples.push({title:document.title, text:Array.from(document.querySelectorAll('[data-branding]'))
                .filter(el => getComputedStyle(el).visibility !== 'hidden').map(el => el.textContent)});
            if (frameSamples.length < 240) requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
        setTimeout(() => { document.title = ${JSON.stringify(originalTitle)}; }, 0);
        setTimeout(() => { document.title = ${JSON.stringify(tagline)}; }, 20);
        </script></body></html>`;
}

function HiddenWindow(options) {
    const win = new BrowserWindow({ ...options, show: false,
        webPreferences: { ...options.webPreferences, session: session.fromPartition('branding-regression') } });
    windows.push(win);
    nativeTitles.push(win.getTitle());
    win.on('page-title-updated', (event, title) => {
        titleEvents.push({ event, title });
        setImmediate(() => {
            if (!win.isDestroyed()) nativeTitles.push(win.getTitle());
        });
    });
    win.webContents.on('preload-error', (_event, _file, error) => preloadErrors.push(error.message));
    win.webContents.on('console-message', event => {
        if (event.level === 'error') console.error('Renderer:', event.message);
    });
    return win;
}

function verifyFrames(samples) {
    assert.ok(samples.length > 0);
    for (const sample of samples) {
        assert.equal(sample.title, brand, 'title at a rendered frame');
        assert.equal(sample.text.some(text => forbidden.test(text)), false, 'visible branding at a rendered frame');
    }
}

app.whenReady().then(async () => {
    session.fromPartition('branding-regression').setSpellCheckerEnabled(false);
    server = http.createServer((request, response) => {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(html(request.url.startsWith('/student')));
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const controller = createWindowController({
        BrowserWindow: HiddenWindow, preloadPath: preload, iconPath: undefined,
        // Local-only fixture origin; production origin enforcement has separate unit coverage.
        policy: {
            isAllowedUrl: value => { try { return new URL(value).origin === origin; } catch { return false; } },
            getWindowKind: value => new URL(value).pathname.startsWith('/k/') ? 'score' : 'child'
        }
    });
    const win = controller.createWindow(origin + '/student/113103', 'main');
    const evaluate = script => win.webContents.executeJavaScript(script);
    await once(win.webContents, 'did-finish-load');
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.deepEqual(preloadErrors, []);
    assert.equal(win.getTitle(), brand);
    assert.equal(await evaluate('document.title'), brand);
    assert.equal(await evaluate('document.querySelector("#brand-text").textContent'), brand);
    assert.equal(await evaluate('document.querySelector("#split-text").textContent'), brand);
    assert.equal(await evaluate('document.querySelector("#brand-link").title'), brand);
    assert.equal(await evaluate('document.querySelector("meta[name=description]").content'), brand);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("input")).map(input => input.value)'),
        ['unchanged-account', 'unchanged-password']);
    verifyFrames(await evaluate('frameSamples'));
    console.log('PASS: initial login title, metadata and split branding are sanitized without unsafe frame samples');

    await evaluate(`frameSamples = []; history.pushState({}, '', '/kaoshi/practice');
        document.title = ${JSON.stringify(originalTitle)};
        document.querySelector('#brand-text').textContent = ${JSON.stringify(originalTitle)};
        document.querySelector('#split-text').innerHTML = '<span>考</span><b>试宝</b><span>${tagline}</span>';
        document.querySelector('#brand-link').setAttribute('title', ${JSON.stringify(originalTitle)});`);
    // These reads happen in the next renderer task, without a timer or a cleanup delay.
    assert.equal(await evaluate('document.title'), brand);
    assert.equal(await evaluate('document.querySelector("#brand-text").textContent'), brand);
    assert.equal(await evaluate('document.querySelector("#split-text").textContent'), brand);
    assert.equal(await evaluate('document.querySelector("#brand-link").title'), brand);
    await new Promise(resolve => setTimeout(resolve, 100));
    verifyFrames(await evaluate('frameSamples'));
    console.log('PASS: SPA title and branding writes are sanitized before frame samples without waiting for debounce');

    await evaluate(`frameSamples = []; document.head.outerHTML = '<head><title>${originalTitle}</title>' +
        '<title>${tagline}</title><meta property="og:title" content="考试宝"></head>';`);
    assert.deepEqual(await evaluate('Array.from(document.head.querySelectorAll("title")).map(el => el.textContent)'), [brand, brand]);
    assert.equal(await evaluate('document.head.querySelector("meta").content'), brand);
    await evaluate(`document.head.querySelector('title').firstChild.nodeValue = ${JSON.stringify(originalTitle)}`);
    assert.equal(await evaluate('document.title'), brand);
    await evaluate('document.head.querySelectorAll("title").forEach(title => title.remove())');
    assert.equal(await evaluate('document.title'), brand);
    await new Promise(resolve => setTimeout(resolve, 80));
    verifyFrames(await evaluate('frameSamples'));
    console.log('PASS: replacing the head, duplicate titles, text-node edits and title removal keep the safe title');

    const loaded = once(win.webContents, 'did-finish-load');
    await win.loadURL(origin + '/kaoshi/practice');
    await loaded;
    await new Promise(resolve => setTimeout(resolve, 150));
    verifyFrames(await evaluate('frameSamples'));
    assert.equal(win.getTitle(), brand);
    console.log('PASS: full-page navigation keeps native and rendered titles free of original branding');

    await evaluate(`window.open('${origin}/k/123'); void 0;`);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(windows.length, 2);
    assert.equal(windows[1].getTitle(), '成绩详情');
    assert.equal(await windows[1].webContents.executeJavaScript('document.title'), brand);
    assert.ok(titleEvents.length > 0);
    assert.equal(titleEvents.every(entry => entry.event.defaultPrevented), true);
    assert.equal(nativeTitles.some(title => forbidden.test(title)), false);
    assert.deepEqual(preloadErrors, []);
    console.log('PASS: production window handlers cancel every remote title update, including popup windows');

    clearTimeout(watchdog);
    windows.forEach(window => { if (!window.isDestroyed()) window.destroy(); });
    server.close();
    app.exit(0);
}).catch(error => {
    clearTimeout(watchdog);
    console.error(error);
    windows.forEach(window => { if (!window.isDestroyed()) window.destroy(); });
    server?.close();
    app.exit(1);
});
