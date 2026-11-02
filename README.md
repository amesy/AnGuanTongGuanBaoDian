# 安管通关宝典

安管通关宝典是一款基于 Electron 构建的 Windows 桌面端学习与考试应用。

本项目主要用于提供稳定、简洁的在线刷题、考试及成绩查看体验。

---

## 📌 项目简介

安管通关宝典基于 Electron 构建，通过桌面应用方式访问在线考试系统。

主要功能包括：

- 在线登录
- 在线刷题
- 在线考试
- 考试成绩查看
- 试卷详情查看
- 多窗口考试页面管理
- 页面异常自动恢复
- 页面加载防闪烁
- Windows 桌面应用运行
- Windows 安装程序生成

---

## 💻 运行环境

### 用户端

支持：

- Windows 10
- Windows 11
- x64

普通用户无需安装 Node.js 或 Electron。

下载安装程序后直接安装即可。

---

## 📦 安装

从 GitHub Releases 下载最新版本安装程序：

```text
AnGuanTongGuanBaodian-Setup-x.x.x.exe
```

运行安装程序，根据提示完成安装。

安装完成后，可以通过：

桌面快捷方式
开始菜单

启动「安管通关宝典」。

## 🚀 开发环境

如果需要进行项目开发，需要安装：
- Node.js
- npm
- Git

进入项目目录：
```bash
npm ci
```

## ▶️ 开发运行
执行：
```bash
npm start
```

即可启动开发版本。

正常启动默认关闭开发者工具。需要调试时执行 `npm run start:debug`；安装包始终关闭开发者工具，即使传入调试参数也不会启用。

Windows 中文输出与编码检查：

```powershell
.\scripts\project.cmd check:encoding
.\scripts\project.cmd test
.\scripts\project.cmd test:login
```

该入口在命令执行期间使用 UTF-8 代码页，并在结束后恢复原代码页，不修改系统设置或 PowerShell 执行策略。使用 Windows PowerShell 管道传递中文时，还应在当前会话中设置管道和控制台编码：

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $OutputEncoding
[Console]::InputEncoding = $OutputEncoding
chcp 65001 > $null
```

项目文本统一使用无 BOM 的 UTF-8，`npm run check:encoding` 检查非法字节、替换字符及异常私用字符。Electron 测试会隔离工作目录、配置和 AppData，检查项目根目录是否出现额外文件，并清理临时数据。项目窗口关闭未使用的拼写检查；受限 Windows 环境仍可能在测试临时目录中生成原生组件缓存，这些缓存会随测试目录清理。

登录交互回归验证：

```bash
npm test
npm run test:login
npm run test:branding
```

`npm test` 检查启动异常、窗口恢复、URL 限制、登录焦点和发布目录替换；`npm run test:login` 使用独立临时配置、工作目录和本地页面，在隐藏的 Electron 窗口中检查登录失败后的删除、重输、弹窗、前端路由切换及增量页面清理，不访问真实账号。受限环境下该测试窗口关闭 Chromium 进程沙箱，应用运行时的窗口配置不受影响。真实站点和 Windows 原生提示框仍需手动回归。

`npm run test:branding` 检查初次登录、前端路由、整页导航、标题节点和 head 替换、弹窗的标题屏蔽。所有窗口在加载页面前阻止网页标题接管窗口；网页的全部 title 节点固定为“安管通关宝典”。登录页和动态页面的原站品牌字样替换为应用名称，宣传语移除，相关提示属性和页面描述同步清理。标题及动态品牌文字即时处理，不等待普通 DOM 清理定时器；被内联标签拆开的词句也会处理。

所有顶层窗口只允许访问 `config.js` 指定的 HTTPS 来源（协议、主机及端口均一致）；试卷详情、成绩详情和普通页面统一使用这条规则。页面请求失败或渲染进程异常时自动重试，连续失败会逐步延长间隔至 30 秒。正常页面不会定时刷新。

页面清理由 DOM 变化和前端路由事件触发，合并处理变化区域，不再固定轮询整页。登录错误会立即恢复编辑；品牌替换不会改动输入值、可编辑区域或脚本内容。

## 📦 构建 Windows 安装程序

Windows x64 本机打包会直接复用 `node_modules/electron/dist` 中已经安装的 Electron，避免构建器再次连接 GitHub 下载 Electron 或校验清单。如果此目录不存在，请先完成 `npm ci`。NSIS 等打包工具仍使用 electron-builder 的缓存；新电脑首次获取这些工具需要可用网络。

遇到 `connect ETIMEDOUT ...:443` 时，这是依赖下载连接超时。先查看报错前的下载资源名称，保留已有 Electron 和打包工具缓存，再重试打包；更换 npm registry 只能影响 npm 包下载，不能自动解决 GitHub 发布附件的下载问题。

`npm run release:prepare` 会混淆入口脚本与 `lib/` 下的运行时模块，并复制资源到 `release-src/`。只有全部文件生成成功后才替换旧目录；生成失败时保留旧版本。新增公共运行时模块请放入 `lib/`，支持 `.js`、`.cjs` 和 `.json`。

执行:
```bash
npm run dist
```

构建完成后，安装程序会生成在：
```text
dist/
```

例如：
```text
dist/
└── 安管通关宝典-Setup-1.0.4.exe
```

## 🔖 版本发布:
项目使用 Git Tag 管理版本。
例如发布：
```text
v1.0.4
```
首先修改 package.json：
```json
{
  "version": "1.0.4"
}
```

然后执行：
```bash
npm run dist
```

确认 EXE 正常生成并测试通过后, 发布到Github。

## 📁 项目结构：
```text
安管通关宝典/
│
├── assets/
│   └── icon.ico
│
├── main.js
├── preload.js
├── config.js
├── lib/
│   ├── url-policy.js
│   ├── window-controller.js
│   └── login-focus.js
├── tests/
├── package.json
├── package-lock.json
├── build-release.js
│
├── dist/
│   └── 安管通关宝典-Setup-x.x.x.exe
│
└── README.md
```

## 🛠️ 技术栈

本项目主要使用：
```text
Electron
Node.js
JavaScript
HTML
CSS
electron-builder
```

## 📋 版本记录

v1.0.4 完整升级说明见 [RELEASE_NOTES_1.0.4.md](RELEASE_NOTES_1.0.4.md)。

```text
v1.0.4
修复登录失败后输入框不能立即修改的问题
优化标题防闪烁、品牌文字和宣传语屏蔽
完善多窗口管理、异常恢复和页面访问限制
优化动态页面清理及中文编码处理
完善自动化测试、缓存隔离和安装包构建
v1.0.3
优化页面加载体验
优化页面切换防闪烁机制
优化刷题页面切换体验
v1.0.2
优化考试窗口管理
优化成绩详情窗口
优化试卷详情窗口
增强网页异常自动恢复能力
优化 Windows 桌面端体验
v1.0.1
完善考试页面
完善成绩查看
优化多窗口处理
优化页面显示
增强程序稳定性
v1.0.0
初始版本
```
## 📄 许可证

本项目为内部使用项目。

未经授权，不得复制、修改、重新发布或用于其他商业用途。

## 📮 联系

如遇到程序使用问题，请联系作者。
