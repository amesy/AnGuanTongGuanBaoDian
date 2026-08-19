'use strict';

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = __dirname;
const RELEASE = path.join(ROOT, 'release-src');


// ======================================================
// 清理发布目录
// ======================================================

if (fs.existsSync(RELEASE)) {
    fs.rmSync(RELEASE, {
        recursive: true,
        force: true
    });
}

fs.mkdirSync(RELEASE, {
    recursive: true
});


// ======================================================
// JS 混淆配置
// ======================================================

const obfuscatorOptions = {

    compact: true,

    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.65,

    deadCodeInjection: false,

    debugProtection: false,

    disableConsoleOutput: false,

    identifierNamesGenerator: 'hexadecimal',

    renameGlobals: false,

    selfDefending: true,

    stringArray: true,

    stringArrayCallsTransform: true,

    stringArrayCallsTransformThreshold: 0.75,

    stringArrayEncoding: [
        'base64'
    ],

    stringArrayIndexShift: true,

    stringArrayRotate: true,

    stringArrayShuffle: true,

    stringArrayWrappersCount: 1,

    stringArrayWrappersChainedCalls: true,

    stringArrayWrappersParametersMaxCount: 3,

    stringArrayWrappersType: 'function',

    stringArrayThreshold: 0.75,

    transformObjectKeys: true,

    unicodeEscapeSequence: false
};


// ======================================================
// 混淆 JS
// ======================================================

function obfuscateFile(fileName) {

    const sourcePath =
        path.join(ROOT, fileName);

    const targetPath =
        path.join(RELEASE, fileName);

    if (!fs.existsSync(sourcePath)) {

        throw new Error(
            `找不到文件：${fileName}`
        );

    }

    console.log(
        `正在混淆 ${fileName} ...`
    );

    const source =
        fs.readFileSync(
            sourcePath,
            'utf8'
        );

    const result =
        JavaScriptObfuscator.obfuscate(
            source,
            obfuscatorOptions
        );

    fs.writeFileSync(
        targetPath,
        result.getObfuscatedCode(),
        'utf8'
    );

    console.log(
        `${fileName} 混淆完成`
    );
}


// ======================================================
// 复制文件
// ======================================================

function copyFile(fileName) {

    const source =
        path.join(
            ROOT,
            fileName
        );

    const target =
        path.join(
            RELEASE,
            fileName
        );

    if (fs.existsSync(source)) {

        fs.copyFileSync(
            source,
            target
        );

        console.log(
            `复制 ${fileName}`
        );
    }
}


// ======================================================
// main.js / preload.js
// ======================================================

obfuscateFile('main.js');

obfuscateFile('preload.js');


// ======================================================
// config.js
// ======================================================

copyFile('config.js');


// ======================================================
// package.json
// ======================================================

const packageJson =
    JSON.parse(
        fs.readFileSync(
            path.join(
                ROOT,
                'package.json'
            ),
            'utf8'
        )
    );


const releasePackage = {

    name: packageJson.name,

    version: packageJson.version,

    description: packageJson.description,

    main: 'main.js'

};


fs.writeFileSync(

    path.join(
        RELEASE,
        'package.json'
    ),

    JSON.stringify(
        releasePackage,
        null,
        2
    ),

    'utf8'
);


// ======================================================
// assets
// ======================================================

// ======================================================
// assets
// ======================================================

const assetsSource =
    path.join(
        ROOT,
        'assets'
    );

const assetsTarget =
    path.join(
        RELEASE,
        'assets'
    );


console.log(
    '检查 assets:',
    assetsSource
);


if (!fs.existsSync(assetsSource)) {

    throw new Error(
        `找不到 assets 目录: ${assetsSource}`
    );

}


fs.mkdirSync(
    assetsTarget,
    {
        recursive: true
    }
);


const assetFiles =
    fs.readdirSync(
        assetsSource
    );


console.log(
    'assets 文件:',
    assetFiles
);


for (
    const file of assetFiles
) {

    const source =
        path.join(
            assetsSource,
            file
        );

    const target =
        path.join(
            assetsTarget,
            file
        );


    fs.cpSync(
        source,
        target,
        {
            recursive: true
        }
    );


    console.log(
        `复制 assets: ${file}`
    );

}


// ======================================================
// 检查发布目录
// ======================================================

console.log('');

console.log(
    '发布目录内容:'
);

console.log(
    fs.readdirSync(
        RELEASE
    )
);


// ======================================================
// 完成
// ======================================================

console.log('');

console.log(
    '========================================'
);

console.log(
    '发布版准备完成'
);

console.log(
    '========================================'
);

console.log('');

console.log(
    `发布目录：${RELEASE}`
);

console.log('');