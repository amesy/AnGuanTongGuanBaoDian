'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { decodeProcessOutput } = require('../scripts/process-output.cjs');

const root = path.resolve(__dirname, '..');
const rootEntriesBefore = new Set(fs.readdirSync(root));
const temporaryRoot = path.join(root, 'tmp');
fs.mkdirSync(temporaryRoot, { recursive: true });
const profile = fs.mkdtempSync(path.join(temporaryRoot, 'login-regression-'));
if (path.dirname(path.resolve(profile)) !== temporaryRoot) {
    throw new Error('Unexpected regression profile path');
}

function findSpellingArtifacts(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
        const child = path.join(directory, entry.name);
        if (entry.name === 'Spelling' && path.basename(directory) === 'Microsoft') return true;
        if (findSpellingArtifacts(child)) return true;
    }
    return false;
}

let exitStatus = 1;
let hadSpellingArtifacts = false;
try {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    env.APPDATA = path.join(profile, 'Roaming');
    env.LOCALAPPDATA = path.join(profile, 'Local');
    fs.mkdirSync(env.APPDATA, { recursive: true });
    fs.mkdirSync(env.LOCALAPPDATA, { recursive: true });
    const args = process.argv.slice(2);
    const branding = args.includes('--branding');
    const preloadArgument = args.find(argument => argument !== '--branding');
    const preload = preloadArgument ? path.resolve(preloadArgument) : path.join(root, 'preload.js');
    const fixture = branding ? 'title-branding.electron.cjs' : 'login-inputs.electron.cjs';
    const result = spawnSync(require('electron'), [path.join(__dirname, fixture), profile, preload], {
        cwd: profile, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
        timeout: 35000, maxBuffer: 8 * 1024 * 1024
    });
    process.stdout.write(decodeProcessOutput(result.stdout));
    process.stderr.write(decodeProcessOutput(result.stderr));
    if (result.error) console.error(result.error);
    hadSpellingArtifacts = findSpellingArtifacts(profile);
    if (result.status === 0 && !result.error) exitStatus = 0;
} catch (error) {
    console.error('Electron regression failed:', error.message);
} finally {
    // Even process launch failures, timeouts and decoding errors must clean up the isolated profile.
    try {
        fs.rmSync(profile, { recursive: true, force: true });
        if (fs.existsSync(profile)) exitStatus = 1;
    } catch (error) {
        exitStatus = 1;
        console.warn('Temporary regression profile is still in use:', error.message);
    }
    const unexpectedEntries = fs.readdirSync(root).filter(name => !rootEntriesBefore.has(name) && name !== 'tmp');
    if (unexpectedEntries.length) {
        exitStatus = 1;
        console.error('Unexpected project-root entries:', unexpectedEntries.map(name =>
            JSON.stringify(name).replace(/[^\x20-\x7e]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'))));
    }
}
if (exitStatus === 0) {
    if (hadSpellingArtifacts) console.log('PASS: native spelling cache was confined to and removed with the isolated temporary profile');
    console.log('PASS: project root is unchanged and temporary runtime data was cleaned');
}
process.exitCode = exitStatus;
