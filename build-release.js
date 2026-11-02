'use strict';

const fs = require('node:fs');
const path = require('node:path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const obfuscatorOptions = {
    compact: true,
    controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.65,
    deadCodeInjection: false, debugProtection: false, disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal', renameGlobals: false, selfDefending: true,
    stringArray: true, stringArrayCallsTransform: true, stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'], stringArrayIndexShift: true,
    stringArrayRotate: true, stringArrayShuffle: true,
    stringArrayWrappersCount: 1, stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 3, stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75, transformObjectKeys: true, unicodeEscapeSequence: false
};

function assertInside(root, target) {
    const relative = path.relative(path.resolve(root), path.resolve(target));
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
        throw new Error('发布路径超出项目目录: ' + target);
    }
}

function collectFiles(directory, prefix = '') {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isSymbolicLink()) throw new Error('发布目录不接受符号链接: ' + entry.name);
        const relative = path.join(prefix, entry.name);
        if (entry.isDirectory()) files.push(...collectFiles(path.join(directory, entry.name), relative));
        else if (entry.isFile()) files.push(relative);
    }
    return files;
}

function prepareRelease({ root = __dirname, obfuscate = source =>
    JavaScriptObfuscator.obfuscate(source, obfuscatorOptions).getObfuscatedCode() } = {}) {
    root = path.resolve(root);
    const output = path.join(root, 'release-src');
    assertInside(root, output);
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
    const runtimeFiles = ['main.js', 'preload.js', 'config.js'];
    if (fs.existsSync(path.join(root, 'lib'))) {
        for (const file of collectFiles(path.join(root, 'lib'))) {
            if (/\.(js|cjs|json)$/.test(file)) runtimeFiles.push(path.join('lib', file));
        }
    }
    for (const file of runtimeFiles) fs.accessSync(path.join(root, file), fs.constants.R_OK);
    const assets = collectFiles(path.join(root, 'assets'));
    if (!assets.includes('icon.ico')) throw new Error('缺少 assets/icon.ico');

    const temporaryRoot = path.join(root, 'tmp');
    fs.mkdirSync(temporaryRoot, { recursive: true });
    const work = fs.mkdtempSync(path.join(temporaryRoot, 'release-prepare-'));
    const staged = path.join(work, 'staged');
    const previous = path.join(work, 'previous');
    fs.mkdirSync(staged);
    let installed = false;
    let movedPrevious = false;
    try {
        for (const file of runtimeFiles) {
            const destination = path.join(staged, file);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            const source = fs.readFileSync(path.join(root, file), 'utf8');
            fs.writeFileSync(destination, /\.(js|cjs)$/.test(file) ? obfuscate(source) : source, 'utf8');
        }
        for (const file of assets) {
            const destination = path.join(staged, 'assets', file);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.copyFileSync(path.join(root, 'assets', file), destination);
        }
        const manifest = {
            name: packageJson.name, version: packageJson.version,
            description: packageJson.description, author: packageJson.author, main: 'main.js'
        };
        if (packageJson.dependencies) manifest.dependencies = packageJson.dependencies;
        fs.writeFileSync(path.join(staged, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');

        // 成功生成全部文件后才替换旧发布目录，构建失败时保留可用版本。
        assertInside(root, staged);
        assertInside(root, previous);
        if (fs.existsSync(output)) {
            fs.renameSync(output, previous);
            movedPrevious = true;
        }
        fs.renameSync(staged, output);
        installed = true;
        return output;
    } catch (error) {
        if (movedPrevious && !fs.existsSync(output)) {
            try {
                fs.renameSync(previous, output);
                movedPrevious = false;
            } catch (restoreError) {
                throw new AggregateError([error, restoreError], '发布目录恢复失败，原文件保留于: ' + previous);
            }
        }
        throw error;
    } finally {
        // 仅清理由本次构建创建的目录；回滚失败时保留备份。
        assertInside(temporaryRoot, work);
        if (!movedPrevious || installed) {
            try {
                fs.rmSync(work, { recursive: true, force: true });
            } catch (error) {
                console.warn('临时构建目录未清理:', work, error.message);
            }
        }
    }
}

if (require.main === module) {
    try {
        console.log('发布版准备完成:', prepareRelease());
    } catch (error) {
        console.error('发布版准备失败:', error);
        process.exitCode = 1;
    }
}

module.exports = { prepareRelease };
