# PACHINKO · PON PON · 弹一点小快乐

一个可爱、轻松的网页柏青哥游乐场。无需账号、后端或 API 密钥。

## 网页直接玩（推荐）

GitHub Pages 首次部署成功后，直接打开 **[PON PON 在线游戏](https://roukeiyu.github.io/PACHINKO/)** 即可游玩。手机、电脑都可以；玩家无需下载项目或安装 Node.js。

仓库已配置自动发布：推送到 `main` 后，GitHub Actions 会安装依赖、构建并部署游戏。源码仓库页面用于查看代码，游戏链接才是可直接游玩的网页。

仓库管理员首次开启：

1. 打开 [Settings → Pages](https://github.com/Roukeiyu/PACHINKO/settings/pages)。
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 到 [Actions](https://github.com/Roukeiyu/PACHINKO/actions/workflows/pages.yml) 选择 **Deploy game to GitHub Pages → Run workflow → main → Run workflow**。也可重新运行之前因 Pages 尚未开启而失败的工作流。
4. 等待 `build` 和 `deploy` 均成功，再打开游戏链接。首次发布前或发布失败时，链接可能返回 404。

在线版最高分与设置保存在当前浏览器中，不上传 GitHub。后续更新只需推送代码，无需重复配置 Pages。

## 从 GitHub 获取并运行

克隆本仓库或通过 Code → Download ZIP 下载并解压。安装 Node.js 24 LTS 后，在项目目录运行：

```sh
npm ci
npm run dev
```

Windows 也可直接双击 `start-dev.cmd`，首次自动安装依赖并打开浏览器。仓库不提交 `node_modules/` 和构建产物 `dist/`；从 GitHub 下载后，如需使用 `start-game.cmd`，请先运行 `npm ci` 和 `npm run build`。下方的预构建压缩包说明适用于聊天中提供的完整项目包。

## Windows 本地使用（无需 GitHub）

1. 把压缩包内容解压到 `D:\Pachinko`，确保该目录下直接包含 `package.json` 和 `start-game.cmd`。
2. 安装 Node.js 24 LTS（如果已经安装则跳过）。
3. 双击 `start-game.cmd`：使用包内已构建的 `dist/`，自动打开浏览器，无需安装 npm 依赖，运行时不需要联网。关闭命令窗口或按 Ctrl+C 停止。
4. 要修改源码，双击 `start-dev.cmd`：首次会通过 npm 安装依赖（需要联网），之后启动支持热更新的开发服务。无需 Git 或 GitHub 账号。

也可以在 PowerShell 中开发：

```powershell
cd D:\Pachinko
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --open
```

修改源码后执行 `npm.cmd run build` 更新 `dist/`，再通过 `start-game.cmd` 运行最新构建。此压缩包不包含 `.git` 或 Linux 的 `node_modules`；源码、锁文件、构建文件、测试及验证截图均保留。浏览器内原有的最高分和设置属于浏览器本地数据，不随文件迁移。

## 运行

需要 Node.js 20.19+ 或 22.12+（云环境已使用 Node.js 24 验证）。

```sh
npm ci
npm run dev -- --port 5173
```

```sh
npm run build
npm run preview -- --port 4173
```

## 玩法

- 点击球台或移动滑块选择发射位置，点击「发射小快乐」或按空格发射。
- 「自动投球」每 0.7 秒发射一颗，再次点击即可暂停。
- 设置内选择 5、7、9 个槽位，以及动物、甜品、植物花朵主题；侧栏也可快速切换主题。
- 每个槽位按倍率计分，中央幸运槽为 100 分。没有付费、赌注或兑换机制。
- 音效在首次交互后启用，可静音或调整音量。轻柔模式减少装饰动画，默认尊重系统减少动态效果设置。
- 设置与最高分保存在本地浏览器。打开设置或切到后台时暂停物理模拟；切换槽位会清空在途小球并保留得分。

## 实现

Vite + 原生 JavaScript / Canvas + Matter.js 固定步长物理模拟。Web Audio 实时合成发射、碰撞和落袋音效，不依赖外部图片、字体或音频请求。应用可静态部署 `dist/`。

## 浏览器验证

先运行开发服务器，再运行：

```sh
npm test
```

Linux 环境优先使用 `/usr/bin/chromium`；Windows 首次测试前运行 `npx.cmd playwright install chromium`。也可通过 `CHROMIUM_PATH` 指定浏览器路径，`TEST_URL` 可指定开发服务器地址。测试覆盖真实落球计分、三种槽位、主题切换、自动发射、设置持久化、声音初始化及移动端布局。截图保存至忽略的 `test-results/`。只读物理诊断接口仅在开发模式存在。
