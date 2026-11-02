const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { prepareRelease } = require('../build-release');

const temporaryRoot = path.resolve(__dirname, '..', 'tmp');

function fixture(t) {
    fs.mkdirSync(temporaryRoot, { recursive: true });
    const root = fs.mkdtempSync(path.join(temporaryRoot, 'release-test-'));
    t.after(() => {
        if (path.dirname(path.resolve(root)) !== temporaryRoot) throw new Error('Invalid test directory');
        fs.rmSync(root, { recursive: true, force: true });
    });
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'assets', 'icon.ico'), 'fixture');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        name: 'fixture', version: '1.0.3', main: 'main.js', scripts: { test: 'test' }, devDependencies: { test: '1' }
    }));
    for (const name of ['main.js', 'preload.js', 'config.js']) fs.writeFileSync(path.join(root, name), 'const value = 1;');
    return root;
}

test('packages nested runtime modules and data while excluding development files', t => {
    const root = fixture(t);
    fs.mkdirSync(path.join(root, 'lib', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(root, 'lib', 'nested', 'module.js'), 'module.exports = 42;');
    fs.writeFileSync(path.join(root, 'lib', 'data.json'), '{"value":42}');
    const output = prepareRelease({ root, obfuscate: source => '/* processed */' + source });
    assert.match(fs.readFileSync(path.join(output, 'lib', 'nested', 'module.js'), 'utf8'), /^\/\* processed \*\//);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'lib', 'data.json'), 'utf8')), { value: 42 });
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'package.json'), 'utf8'));
    assert.equal(manifest.version, '1.0.3');
    assert.equal(manifest.devDependencies, undefined);
    assert.equal(manifest.scripts, undefined);
    assert.equal(fs.existsSync(path.join(output, 'assets', 'icon.ico')), true);
});

test('failed obfuscation preserves the previous release and successful replacement removes stale files', t => {
    const root = fixture(t);
    const output = prepareRelease({ root, obfuscate: source => source });
    fs.writeFileSync(path.join(output, 'previous.txt'), 'last usable release');
    assert.throws(() => prepareRelease({ root, obfuscate: () => { throw new Error('obfuscation failed'); } }), /obfuscation failed/);
    assert.equal(fs.readFileSync(path.join(output, 'previous.txt'), 'utf8'), 'last usable release');
    prepareRelease({ root, obfuscate: source => source });
    assert.equal(fs.existsSync(path.join(output, 'previous.txt')), false);
});

test('package and lock metadata agree', () => {
    const manifest = require('../package.json');
    const lock = require('../package-lock.json');
    assert.equal(lock.version, manifest.version);
    assert.equal(lock.packages[''].version, manifest.version);
    assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
});
