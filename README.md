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
npm install
```

## ▶️ 开发运行
执行：
```bash
npm start
```

即可启动开发版本。

## 📦 构建 Windows 安装程序
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
└── 安管通关宝典-Setup-1.0.3.exe
```

## 🔖 版本发布:
项目使用 Git Tag 管理版本。
例如发布：
```text
v1.0.3
```
首先修改 package.json：
```json
{
  "version": "1.0.3"
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
```text
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
