const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { createWindowController } = require('../lib/window-controller');
const { createUrlPolicy } = require('../lib/url-policy');

const url = 'https://s.kaoshibao.com/student/113103';

function fixture({ failLoad = false, allowDevTools = false } = {}) {
    const windows = [];
    const timers = new Map();
    let nextTimer = 0;
    class FakeWindow extends EventEmitter {
        constructor(options) {
            super();
            this.options = options;
            this.destroyed = false;
            this.webContents = new EventEmitter();
            this.webContents.isDestroyed = () => this.destroyed;
            this.webContents.getURL = () => this.url;
            this.webContents.setWindowOpenHandler = handler => { this.openHandler = handler; };
            this.webContents.send = (...args) => { this.sent = args; };
            this.webContents.isDevToolsOpened = () => false;
            this.webContents.openDevTools = () => { this.toolsOpened = true; };
            this.webContents.closeDevTools = () => { this.toolsClosed = true; };
            this.webContents.reload = () => {
                this.reloads = (this.reloads || 0) + 1;
                this.webContents.emit('did-start-navigation', {}, this.url, false, true);
            };
            windows.push(this);
        }
        isDestroyed() { return this.destroyed; }
        destroy() { this.destroyed = true; this.emit('closed'); }
        loadURL(target) {
            this.url = target;
            this.handlersReady = typeof this.openHandler === 'function' &&
                this.webContents.listenerCount('will-navigate') > 0 &&
                this.listenerCount('page-title-updated') > 0;
            if (failLoad) {
                this.webContents.emit('did-fail-load', {}, -105, 'DNS failure', target, true);
                return Promise.reject(Object.assign(new Error('DNS failure'), { errno: -105 }));
            }
            return Promise.resolve();
        }
    }
    const controller = createWindowController({
        BrowserWindow: FakeWindow, policy: createUrlPolicy(url), allowDevTools,
        preloadPath: 'preload.js', iconPath: 'icon.ico', logger: { error() {} },
        setTimer: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
        clearTimer: id => timers.delete(id)
    });
    function runTimer() {
        const [id, timer] = timers.entries().next().value;
        timers.delete(id);
        timer.callback();
    }
    return { controller, windows, timers, runTimer };
}

test('first load failure retains handlers and uses a single recovery timer', async () => {
    const f = fixture({ failLoad: true });
    const win = f.controller.createWindow(url, 'main');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(win.handlersReady, true);
    assert.equal(f.timers.size, 1);
    win.webContents.emit('did-finish-load');
    assert.equal(f.timers.size, 1, 'an error document must not cancel recovery');
    f.runTimer();
    win.webContents.emit('did-finish-load');
    assert.equal(win.openHandler({ url: 'https://s.kaoshibao.com/k/123?code=dynamic' }).action, 'deny');
    assert.equal(f.windows[1].options.title, '成绩详情');
    await new Promise(resolve => setImmediate(resolve));
});

test('blocks outside navigation, redirects and popups consistently', () => {
    const f = fixture();
    const win = f.controller.createWindow(url, 'main');
    for (const eventName of ['will-navigate', 'will-redirect']) {
        for (const target of ['https://example.com', 'http://s.kaoshibao.com/k/123']) {
            let prevented = false;
            win.webContents.emit(eventName, { preventDefault: () => { prevented = true; } }, target);
            assert.equal(prevented, true);
        }
        let prevented = false;
        win.webContents.emit(eventName, { preventDefault: () => { prevented = true; } }, url);
        assert.equal(prevented, false);
    }
    win.openHandler({ url: 'http://s.kaoshibao.com/kaoshi/paper/check/' });
    assert.equal(f.windows.length, 1);
    let subframePrevented = false;
    win.webContents.emit('will-redirect', { preventDefault: () => { subframePrevented = true; } },
        'https://cdn.example.com/resource', false, false);
    assert.equal(subframePrevented, false, 'main-window restrictions do not block embedded resource redirects');
    assert.throws(() => f.controller.createWindow('https://example.com'));
});

test('ignores aborted loads and subframes, cancels recovery on navigation and close', () => {
    const f = fixture();
    const win = f.controller.createWindow(url, 'main');
    win.webContents.emit('did-fail-load', {}, -3, '', url, true);
    win.webContents.emit('did-fail-load', {}, -105, '', url, false);
    assert.equal(f.timers.size, 0);
    win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    assert.equal(f.timers.size, 1);
    win.webContents.emit('did-start-navigation', {}, url, false, true);
    assert.equal(f.timers.size, 0);
    win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    win.destroy();
    assert.equal(f.timers.size, 0);
});

test('recovery backs off, caps delay, resets on success and survives reload exceptions', () => {
    const f = fixture();
    const win = f.controller.createWindow(url, 'main');
    for (const delay of [3000, 6000, 12000, 24000, 30000, 30000]) {
        win.webContents.emit('did-fail-load', {}, -105, '', url, true);
        assert.equal(Array.from(f.timers.values())[0].delay, delay);
        f.runTimer();
    }
    win.webContents.emit('did-finish-load');
    win.webContents.emit('did-fail-load', {}, -105, '', url, true);
    assert.equal(Array.from(f.timers.values())[0].delay, 3000);
    win.webContents.reload = () => { throw new Error('temporary failure'); };
    f.runTimer();
    assert.equal(f.timers.size, 1);
});

test('paper and score windows remain independently closable', () => {
    const f = fixture();
    for (const target of ['/kaoshi/paper/check/', '/k/123']) {
        const win = f.controller.createWindow('https://s.kaoshibao.com' + target);
        let prevented = false;
        win.emit('close', { preventDefault: () => { prevented = true; } });
        assert.equal(prevented, true);
        assert.equal(win.destroyed, true);
    }
});

test('DevTools is closed by default and enabled only by explicit configuration', () => {
    const f = fixture();
    const win = f.controller.createWindow(url, 'main');
    assert.equal(win.options.webPreferences.devTools, false);
    assert.equal(win.options.webPreferences.sandbox, true);
    assert.equal(win.options.webPreferences.spellcheck, false);
    win.webContents.emit('devtools-opened');
    assert.equal(win.toolsClosed, true);
    const debug = fixture({ allowDevTools: true }).controller.createWindow(url, 'main');
    assert.equal(debug.options.webPreferences.devTools, true);
    assert.deepEqual(debug.options.webPreferences.additionalArguments, ['--agt-devtools']);
    debug.webContents.emit('did-finish-load');
    assert.equal(debug.toolsOpened, true);
});

test('notifies the preload when a main-frame SPA route changes', () => {
    const win = fixture().controller.createWindow(url, 'main');
    win.webContents.emit('did-navigate-in-page', {}, url, false);
    assert.equal(win.sent, undefined);
    win.webContents.emit('did-navigate-in-page', {}, url, true);
    assert.deepEqual(win.sent, ['agt:page-navigation']);
});

test('all window types prevent remote titles from replacing the native title before loading', () => {
    const f = fixture();
    for (const kind of ['main', 'child', 'paper', 'score']) {
        const win = f.controller.createWindow(url, kind);
        assert.equal(win.handlersReady, true);
        for (const title of ['考试宝', '可以导入题库的在线组卷刷题学习平台',
            '考试宝-可以导入题库的在线组卷刷题学习平台']) {
            let prevented = false;
            win.emit('page-title-updated', { preventDefault: () => { prevented = true; } }, title);
            assert.equal(prevented, true, kind + ': ' + title);
        }
    }
});
