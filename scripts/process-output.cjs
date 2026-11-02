'use strict';

const { TextDecoder } = require('node:util');

function decodeProcessOutput(buffer, { allowLegacyChinese = process.platform === 'win32' } = {}) {
    if (!buffer?.length) return '';
    const utf8 = new TextDecoder('utf-8', { fatal: true });
    const legacy = allowLegacyChinese ? new TextDecoder('gb18030', { fatal: true }) : null;
    // Windows 原生工具可能输出系统代码页，逐行判定，避免误转同一流中的 UTF-8 文本。
    const lines = [];
    let start = 0;
    for (let index = 0; index <= buffer.length; index++) {
        if (index !== buffer.length && buffer[index] !== 10) continue;
        const line = buffer.subarray(start, index);
        try {
            lines.push(utf8.decode(line));
        } catch (error) {
            if (!legacy) throw error;
            lines.push(legacy.decode(line));
        }
        start = index + 1;
    }
    return lines.join('\n');
}

module.exports = { decodeProcessOutput };
