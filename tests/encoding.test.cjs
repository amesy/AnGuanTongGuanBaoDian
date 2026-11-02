const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { inspectText, checkProjectEncoding } = require('../scripts/check-encoding.cjs');
const { decodeProcessOutput } = require('../scripts/process-output.cjs');
const path = require('node:path');

test('project text files are UTF-8 without BOM or corrupted characters', () => {
    assert.deepEqual(checkProjectEncoding(path.resolve(__dirname, '..')).errors, []);
});

test('encoding inspection rejects invalid bytes, BOM and damaged text', () => {
    assert.deepEqual(inspectText(Buffer.from('中文路径与输出', 'utf8')), []);
    assert.ok(inspectText(Buffer.from([0xff, 0xfe])).includes('invalid UTF-8'));
    assert.ok(inspectText(Buffer.from('\uFEFFtext')).includes('UTF-8 BOM'));
    assert.ok(inspectText(Buffer.from('\uFFFD')).includes('replacement character U+FFFD'));
    assert.ok(inspectText(Buffer.from('\uE000')).includes('unexpected private-use character'));
});

test('Chinese UTF-8 subprocess output survives capture and decoding', () => {
    const expected = '安管通关宝典：中文路径、用户名和密码';
    const result = spawnSync(process.execPath, ['-e', 'process.stdout.write(' + JSON.stringify(expected) + ')'], {
        windowsHide: true
    });
    assert.equal(result.status, 0);
    assert.equal(decodeProcessOutput(result.stdout), expected);
});

test('legacy Windows Chinese lines do not corrupt adjacent UTF-8 lines', () => {
    const mixed = Buffer.concat([Buffer.from('UTF-8 中文\n'), Buffer.from([0xd6, 0xd0, 0xce, 0xc4, 10])]);
    assert.equal(decodeProcessOutput(mixed, { allowLegacyChinese: true }), 'UTF-8 中文\n中文\n');
    assert.throws(() => decodeProcessOutput(Buffer.from([0xff]), { allowLegacyChinese: false }));
});
