'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

function inspectText(buffer) {
    const problems = [];
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) problems.push('UTF-8 BOM');
    try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        if (text.includes('\uFFFD')) problems.push('replacement character U+FFFD');
        if (/[\uE000-\uF8FF]/.test(text)) problems.push('unexpected private-use character');
    } catch {
        problems.push('invalid UTF-8');
    }
    return problems;
}

function checkProjectEncoding(root) {
    const files = [];
    function collect(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isFile() && (/\.(js|cjs|json|md|cmd|ps1)$/.test(entry.name) || entry.name === '.editorconfig')) files.push(file);
            if (entry.isDirectory() && (directory !== root || ['lib', 'tests', 'scripts'].includes(entry.name))) collect(file);
        }
    }
    collect(root);
    const errors = files.flatMap(file => inspectText(fs.readFileSync(file))
        .map(problem => path.relative(root, file) + ': ' + problem));
    return { checked: files.length, errors };
}

if (require.main === module) {
    const result = checkProjectEncoding(path.resolve(__dirname, '..'));
    for (const error of result.errors) console.error(error);
    if (result.errors.length) process.exitCode = 1;
    else console.log('编码检查通过：' + result.checked + ' 个项目文本文件均为无 BOM 的 UTF-8，未发现替换字符或异常私用字符。');
}

module.exports = { inspectText, checkProjectEncoding };
