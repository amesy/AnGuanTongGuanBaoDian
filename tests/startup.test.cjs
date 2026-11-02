const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');

async function startup({ packaged = false, debug = false, clearFails = false, invalidConfig = false } = {}) {
    const calls = [];
    const app = new EventEmitter();
    app.isPackaged = packaged;
    app.whenReady = () => Promise.resolve();
    app.quit = () => calls.push('quit');
    const electron = {
        app, BrowserWindow: {}, ipcMain: new EventEmitter(),
        Menu: { setApplicationMenu: () => calls.push('menu') },
        dialog: { showErrorBox: () => calls.push('error') },
        session: { defaultSession: { clearStorageData: async options => {
            calls.push(['clear', options.storages]);
            if (clearFails) throw new Error('storage failure');
        } } }
    };
    let windowOptions;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8'), {
        require: name => {
            if (name === 'electron') return electron;
            if (name === './config') return { websiteUrl: invalidConfig ? 'http://invalid.test' : require('../config').websiteUrl };
            if (name === './lib/login-focus') return { installLoginFocusRecovery: () => calls.push('focus-handler') };
            if (name === './lib/window-controller') return { createWindowController: options => {
                windowOptions = options;
                return { createWindow: () => calls.push('window') };
            } };
            if (name === './lib/url-policy') return require('../lib/url-policy');
            return require(name);
        },
        __dirname: path.join(__dirname, '..'),
        process: { argv: debug ? ['electron', '.', '--agt-devtools'] : ['electron', '.'], platform: 'win32' },
        console: { error() {} }
    });
    await new Promise(resolve => setImmediate(resolve));
    return { calls, windowOptions };
}

test('startup clears login state before opening the main window', async () => {
    const { calls } = await startup();
    assert.equal(calls.indexOf('window') > calls.findIndex(item => Array.isArray(item) && item[0] === 'clear'), true);
    assert.equal(calls.includes('error'), false);
});

test('initialization failures are handled and do not open a partially configured window', async () => {
    for (const options of [{ clearFails: true }, { invalidConfig: true }]) {
        const { calls } = await startup(options);
        assert.equal(calls.includes('window'), false);
        assert.equal(calls.includes('error'), true);
        assert.equal(calls.includes('quit'), true);
    }
});

test('a packaged application ignores the debug argument', async () => {
    assert.equal((await startup({ debug: true })).windowOptions.allowDevTools, true);
    assert.equal((await startup({ debug: true, packaged: true })).windowOptions.allowDevTools, false);
    assert.equal((await startup()).windowOptions.allowDevTools, false);
});
