# dsh-skill-dashboard

技能上手台：DSH Web UI 右侧栏里的一页技能清单。

## 它解决什么

装了很多技能包之后，两件事最难：**不知道自己有哪些技能**，**不知道那些「手动型」技能该怎么叫**。
`disable-model-invocation: true` 的技能不会出现在模型的技能目录里，模型调用会直接报
`skill "xxx" is not available for model invocation` —— 只有你开口点名才会用。
它们在界面上原本是隐形的，这页把它们捞出来，并给一句可以直接照抄的触发语。

## 界面

一页三段：

1. **头部**：小标 `SKILL DASHBOARD` + 标题 + `45 个技能 · 13 个只能点名`，下面是四个数字块（合计 / 需点名 / 有文件 / 注册表），「需点名」用警示色描边。
2. **吸顶工具条**（`position: sticky`）：搜索框（带放大镜图标）、刷新按钮、四个筛选胶囊（每个带计数）。滚到后面时它停在顶部。
3. **内容**：按领域分组（工程流程 / 文档 / 技能与审计 / 查证 / 视觉 / 插件运行时 / 其他），组标题带计数和分隔线；卡片双列自适应（`auto-fill minmax(232px,1fr)`，窄栏自动变单列）。

手动型卡片：左侧 3px 警示色边 + `需点名` 徽章 + 单独一块「怎么说」触发语（警示色浅底），右侧「复制」按钮，复制后变绿并显示「已复制」1.6s。

状态：加载中是 6 个 shimmer 骨架块；空结果给换词提示；失败给错误信息和「重试」。

> **滚动契约**：右侧栏 tab body 必须自己当滚动容器 —— `height: 100%; overflow-y: auto`。第一版写成 `min-height: 100%` 且没有 overflow，结果内容被父容器裁掉、完全没法上下翻。和 `dsh-context` 的 `.lc-root` 是同一套写法。

## 数据来源

Host 半注册 `GET /api/skill-dash/data?session=<sessionId>`。

三级取数，按顺序尝试（响应里的 `via` 字段告诉你是哪一级）：

1. **`catalog`** — `sessionSkillCatalog.list({ sessionId })`：宿主专门给 UI 用的服务，返回**一个会话组合下**用户可调用的全部技能，用户技能 / 项目技能 / 随包技能 / 注册表技能合在一起，`modelInvocable` 直接标出手动型。
2. **`scoped`** — `sessions.scope(sessionId)` + `skills.list({ scope })`：catalog 不可用时的等价取法。
3. **`global`** — `skills.list({})`：只有全局层（本机约 11 条），属于降级结果。

不扫文件、不硬编码技能名，所以注册表里那些没有磁盘文件的技能也在。

> 注意：`skills.list({})` 不带 scope 时**看不到用户技能**（`~/.dsh/skills/*` 在会话组合层）——第一版踩过这个坑，只拿到 11 条。

## 入口

- **会话标题栏右侧的「技能」按钮**：点了开 tab（面板关着时会先展开再重试一次）
- **右侧栏「+」→ 开始页**：tab 类型注册了 `guide` 条目，列表里会出现一行「技能」，点它打开
- tab 本身 `kind: skill-dashboard`

## 已知边界

- 只读：不安装、不启停、不编辑技能（那是 skill-explorer / skills-manager 的事）
- 第一版没有跨会话的「用过哪些」统计（需要解码会话存档，留给下一版）
- 触发语里 curated 的那几条写在 `client.js` 的 `CURATED` 里，其余按说明自动生成

## 开发

```bash
node --check index.js
node --check client.js
```

### 样式注入

动态 Client 模块的工厂作用域里**不一定有 `styles` 这个 builtin**（实测本机没有，`ctx.get('styles')` 也是 undefined）。
没有它，`styles.insert(CSS)` 根本没执行 —— 组件照常渲染，但一个样式都没有：卡片全是裸 `<div>`、SVG 按默认尺寸撑成几百像素、`overflow-y` 不存在所以完全不能滚动。

现在的写法：先试 `styles.insert`，拿不到就自己建一个 `<style data-plugin="dsh-skill-dashboard">` 塞进 `document.head`，用 `ctx.effect` 管清理。图标也补了 `width/height` 属性，样式万一再丢也不会炸成一个大图标。

### 验证

本机没有浏览器控制，`tools/` 下是配的一套窗口级验证工具（纯 PowerShell + .NET，没装任何东西）：

| 脚本 | 作用 |
|---|---|
| `tools/shot.ps1` | 找到 DSH 窗口 → 置前 → 按窗口矩形截图（含 DPI 感知） |
| `tools/crop.ps1` | 裁剪 + 放大某个区域，用来定位按钮坐标 |
| `tools/click.ps1` | 按屏幕坐标左键点击 |
| `tools/wheel.ps1` | 按坐标滚轮（测滚动） |
| `tools/key.ps1` | 给窗口发快捷键（如 `^r` 刷新页面） |

坐标换算：截图位图坐标 = 屏幕坐标 + (11,11)（窗口原点是 -11,-11）；预览图与物理像素比约 1.44。

装进 profile：

```js
plugin_manager({ action: 'install_bundle', target: '<absolute path to this directory>' })
```

**改了 Host 半（`index.js`）必须重载插件**：HMR 不会重新 import Host 模块（观察到的现象是路由还是老逻辑）。
`plugin_manager set_bundle` 关一次再开一次即可，不用重启 DSH。改了 Client 半（`client.js`）刷新页面即可。
