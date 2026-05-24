# hjjjtimer

一个面向手机双人对坐使用的魔方 PK 计时 App。

项目当前基于以下技术实现：
- `Vite + React + TypeScript`
- `Capacitor Android`

仓库内同时包含：
- 前端源码
- Android 工程
- 可直接安装的调试 APK

## 功能

当前版本已实现的主要功能：
- 双人对战计时
- 手机上下双视角镜像显示
- 两边同时按住后，任意一方松手立即开表
- 两边独立停表
- 共用一条打乱
- WCA 常见项目切换
- 比分统计
- 最近 5 把成绩
- `mo3 / ao5 / ao12 / 单次`
- 右下角打乱图预览
- Android 全屏运行

当前已接入项目：
- `222`
- `333`
- `444`
- `555`
- `666`
- `777`
- `333oh`
- `333bf`
- `clock`
- `minx`
- `pyram`
- `skewb`
- `sq1`
- `fto`

## 目录

关键目录说明：
- `src/`：前端页面与交互逻辑
- `android/`：Capacitor Android 工程
- `public/`：静态资源
- `scripts/`：辅助脚本
- `releases/`：仓库内附带的 APK

## 本地开发

安装依赖：

```bash
npm install
```

启动网页开发环境：

```bash
npm run dev
```

局域网开放开发服务器：

```bash
npm run dev:host
```

前端构建：

```bash
npm run build
```

代码检查：

```bash
npm run lint
```

## Android 相关命令

同步前端资源到 Android：

```bash
npm run android:sync
```

打开 Android 工程：

```bash
npm run android:open
```

生成调试 APK：

```bash
npm run android:apk:debug
```

## 手机实时预览

为了避免每次改代码都重新安装 APK，可以使用联机调试模式。

### 1. 启动前端服务

```bash
npm run dev:host
```

### 2. 查询电脑局域网 IP

Windows 可执行：

```powershell
ipconfig
```

### 3. 启动 Android 联机模式

把下面命令中的 IP 换成你电脑当前的局域网地址：

```bash
npm run android:live -- 192.168.1.23
```

这个脚本会：
- 自动设置 `CAP_SERVER_URL`
- 自动 `cap sync android`
- 自动打开 Android 工程

对应脚本位置：
- [scripts/android-live.mjs](/d:/hjjjtimer2.0/scripts/android-live.mjs)

## APK

仓库里当前附带的调试 APK：

- [releases/hjjjtimer2-debug.apk](/d:/hjjjtimer2.0/releases/hjjjtimer2-debug.apk)

Gradle 默认输出目录：

- [android/app/build/outputs/apk/debug/app-debug.apk](/d:/hjjjtimer2.0/android/app/build/outputs/apk/debug/app-debug.apk)

## Capacitor 配置

当前 Capacitor 配置文件：

- [capacitor.config.ts](/d:/hjjjtimer2.0/capacitor.config.ts)

支持通过环境变量 `CAP_SERVER_URL` 切换到开发服务器模式。

## GitHub

当前仓库已推送到：

- `https://github.com/jyh5555/hjjjtimer`

## 说明

仓库里的 APK 是调试版 APK，适合测试使用。

如果后面需要：
- 增加正式签名包
- 做 GitHub Release
- 生成版本号说明
- 写更新日志

可以在这个仓库基础上继续整理。
