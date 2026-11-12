# 交接文档 · dsh-skill-dashboard

> 给接手的新会话看。读完这一份就能开工，不必重读历史对话。
> 最后更新：2026-11-12，对应提交 `27048f6`。

---

## 0. 30 秒版

一个 DSH 插件：在右侧栏开一个「技能」面板，把当前会话能用的技能列出来，**分清哪些模型能自己调、哪些必须你写 `/名字`**，给出可直接复制的触发语；另有一个诊断页，管插件健康、调用统计、归类维护。

代码在 `D:\00code\dsh\plug`（仓库根就是包根），以软链接方式装进 `~/.dsh/profiles/desktop`。

**开工前三件事**：跑 `npm run check`；确认软链接没断（见 §3）；改动后按 §8 的流程重载验证。

---

## 1. 项目状态

- 版本 `0.1.0`，MIT，仓库 `https://github.com/chandlernoidea/dsh-skill-dashboard`
- 当前 12 个提交，工作区干净
- 测试 37 个（`node --test`），全绿
- 打包 14 个文件，`npm pack` 直接发源码（无构建步骤）
- 只读设计（ADR 0001）：只写用户自己的覆盖表，不动包内数据、不改技能文件

规模：

| 文件 | 行数 | 职责 |
|---|---|---|
| `client.js` | 1694 | 整个 UI：样式、文案、两个视图、写法 |
| `index.js` | 789 | Host：路由、读插件、读用量、读写覆盖表 |
| `lib/compose.js` | 147 | 技能 → 处境归类（表优先，推断兜底） |
| `lib/usage.js` | 87 | 从会话事件里数技能调用 |
| `lib/capabilities.js` | 46 | 宿主能力探测 |
| `taxonomy.json` | 204 | 8 个处境 + 45 条技能映射 |

---

## 2. 它解决什么问题

三个真实痛点：

1. **手动型技能是隐形的**。`disable-model-invocation: true` 的技能不进模型目录，模型不知道它存在；你不知道名字就永远用不上。面板直接把 `/名字` 摆出来。
2. **不知道装了什么、用没用**。45 个技能里今天调过哪几个、哪些装了从没用过。
3. **归类乱**。技能按处境分组（写代码 / 审代码 / 写文档 / 研究查证 / 设计出图 / 学习 / 维护 harness / 其他），可手动纠正。

---

## 3. 环境与安装（有个大坑）

插件以**软链接**装进 profile：

```
~/.dsh/profiles/desktop/node_modules/dsh-skill-dashboard -> D:\00code\dsh\plug
~/.dsh/profiles/desktop/package.json: "dsh-skill-dashboard": "link:D:/00code/dsh/plug"
```

**坑（已经踩过一次，插件会整个消失）**：`pnpm-lock.yaml` 里如果还记着旧路径（比如以前在 `plug/dsh-skill-dashboard/` 子目录），重装时 pnpm 会按锁文件建链接，指向不存在的目录 → 客户端模块 404 → 侧栏按钮和 tab 全没了。

排查三步：

```bash
ls -la ~/.dsh/profiles/desktop/node_modules/dsh-skill-dashboard   # 链接指向存在吗
grep "specifier: link:" ~/.dsh/profiles/desktop/pnpm-lock.yaml      # 锁文件路径对不对
curl -s localhost:9729/api/skill-dash/data | head -c 80             # 路由活不活
```

修法：`plugin_manager remove_bundle` → `install_bundle target D:\00code\dsh\plug`。**移动过目录就必须重装一次**，光改 `package.json` 清不掉旧锁文件。

---

## 4. 架构地图

### 路由

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/skill-dash/data` | 技能清单（`?session=`），不含插件健康、不含全量用量 |
| GET | `/api/skill-dash/diagnose` | 插件健康 + 能力 + 归类表元信息 + 可复制文本报告 |
| GET | `/api/skill-dash/usage` | 用量；`?scope=all` 扫最近 30 个会话（8 秒预算） |
| GET | `/api/skill-dash/override` | 导出整份覆盖表 |
| POST | `/api/skill-dash/classify` | `{name}` 或 `{names:[...]}` + `{situation}`，一次写入 |
| POST | `/api/skill-dash/exclude` | `{name, excluded}`，加/移除统计黑名单 |
| POST | `/api/skill-dash/override/import` | 整表替换，校验 `skills` / `exclude` 形状 |

### 数据流

```
sessionSkillCatalog.list({sessionId})            → 技能清单（含 modelInvocable）
  ↓ 退路：sessions.scope(id) + skills.list({scope})
  ↓ 再退路：skills.list({})                      ← 只有全局，缺用户技能
composeDashboard({skills, taxonomy, override, language})
  ↓ 每条技能得 situation / situationSource('taxonomy'|'heuristic') / title / trigger
client 渲染技能页 + 诊断页
```

### 客户端结构

`client.js` 是单文件，由宿主原样提供，**没有打包器**，`import` 走不通。文件顶部有分区说明：路由常量 → 文案字典 → 纯函数 → 样式 → tab 注册 → Dashboard → 诊断页 → 卡片。

---

## 5. 硬知识（别再挖第二遍）

### 5.1 三种技能状态

| 状态 | 判定 | 模型能调 | 用户怎么用 |
|---|---|---|---|
| 模型可调（默认） | frontmatter 没写 `disable-model-invocation` 或写 `false` | 能，按描述匹配 | 直接说需求 |
| 手动型 | `disable-model-invocation: true` | **不能**，调用会报 `not available for model invocation` | **消息里写 `/名字`** |
| 两面都关 | 再加 `user-invocable: false` | 不能 | 也不能，等于死技能 |

判定字段来自宿主目录条目的 `modelInvocable`，**不要按名字猜**。

手动型技能的触发语**必须是 `/名字`**。早期版本给的是「用 X 技能：…」，模型根本调不动——已修，`taxonomy.json` 里 13 条错误的自然语言触发语已删。

### 5.2 事件形态（统计的正确依据）

| 行为 | 事件 |
|---|---|
| 模型调技能 | `tool/call`，`data.name === 'skill'`，`data.arguments` 是 `{"name":"xxx"}` |
| 用户写 `/name` | `user/message`，**`data.source.kind === 'skill-invocation'`**，`data.source.name` 是技能名 |
| 调用失败 | `tool/result`，`data.error` 或 `data.message.isError === true` |

⚠️ `source` 在 **`event.data.source`** 顶层，**不在** `data.message.source`。代码里两个路径都取了，别改回去。

用户点名**不会**产生 `tool/call`，所以两条流天然不重叠，可以精确统计，不需要启发式。

### 5.3 路由的两个限制

- `server.register({ resource })` **只接 GET/HEAD**，POST 会被框架挡成空体 405。写操作必须用 `{ handler }`（Node 的 req/res），自己读 body。两个写接口共用 `postJson()` 包装。
- 客户端 `styles` 内置模块**可能不存在**，必须走 `<style>` 注入兜底，否则面板白屏无样式。

### 5.4 面板滚动

容器要 `height:100%; overflow-y:auto`，光 `min-height:100%` 不会出滚动条（历史 bug）。

### 5.5 侧栏展开

`sidebarRight.openTab(kind)` 在栏目收起时是 no-op，必须先 `isExpanded()` / `toggleExpanded()`。

---

## 6. 功能清单（现状）

**技能页**：搜索、四个分类（全部 / 需点名 / 有文件 / 注册表 / 没写触发条件）、按处境分组、卡片（描述、来源、"写进输入框"、"复制"、"改归属"、批量归类）。手动型卡片带「需点名」角标，描述没写触发条件的带「无触发」角标。

**诊断页**：
- 插件健康（总数 / 活跃 / 停用 / 失败），**停用和失败都列具体名字**
- 宿主能力、归类表版本
- 触发体检：描述里没有「什么时候用」的可调技能 + 一键复制「技能优先」指令块
- 调用统计，**模型自动调用 / 手动 `/name` 两条独立的黄色条形**，明细表双列，可切「本会话 / 全部会话」
- 未调用按处境分组展开
- 归类表导入 / 导出
- 统计黑名单（`⊘` 排除，点名字恢复）

---

## 7. 数据文件

### 包内 `taxonomy.json`
8 个处境（`code / review / docs / research / design / learn / harness / other`，带 `title` 和 `titleEn`），45 条技能映射（`situation`、可选 `zh`）。

### 用户覆盖表 `~/.dsh/skill-dashboard/taxonomy.json`
首次使用时由插件创建，包升级不受影响：

```json
{
  "skills": { "handoff": { "situation": "docs" } },
  "exclude": ["noisy-skill"]
}
```

写入一律「先写 `.tmp` 再 rename」，避免断电写坏。

---

## 8. 验证流程（每次改完都要走）

```bash
cd /d/00code/dsh/plug
node --check index.js && node --check client.js
npm run check          # 语法 + 归类表 + 打包清单 + 37 用例
```

加载到界面：

```
plugin_manager set_bundle enabled:false target:dsh-skill-dashboard   # 重载 host
plugin_manager set_bundle enabled:true  target:dsh-skill-dashboard
```

然后浏览器刷新（`Ctrl+R`），点侧栏「技能」。

**接口可以直接 curl**（比截图快）：

```bash
node -e 'fetch("http://127.0.0.1:9729/api/skill-dash/usage?scope=all").then(r=>r.json()).then(j=>console.log(j))'
```

### 截图工具（`tools/*.ps1`）

`shot.ps1 -ProcessId 13640`（窗口 2582×1390，原点 -11,-11）、`crop.ps1`、`click.ps1`、`key.ps1`、`wheel.ps1`。

**坐标换算**：截图坐标 = 预览坐标 × 1.4408 − 11。**`crop.ps1` 的 `-Scale` 是整数**，传 1.5 会被取整成 2——因为这个我算错过好几次。窗口 PID 会变，先确认。

---

## 9. 已知限制（别当成 bug 反复修）

1. **模型调不调技能，插件管不了**。取决于描述质量 + 会话指令。插件的角色是暴露问题（触发体检）和提供工具（指令块），不是强制。
2. **触发体检是启发式**：只检查描述里有没有 `use when / 用于 / 适合 / 当…时` 这类标记，可能误报。
3. **用量只覆盖能被读到的会话日志**；全量扫描最多 30 个会话、8 秒预算，超时标 `partial`。
4. **`client.js` 拆不了文件**（无打包器），只能文件内分区。
5. **归类对陌生用户是猜的**：包内 45 条是本机的，别人靠关键词推断。
6. **翻译没做**：宿主 `translator` 本机没装，匿名翻译不可靠。定稿是先不做。

---

## 10. 待办路线图

### P0 · client.js 拆分
单文件 1694 行是最大可维护性风险。真拆需要构建步骤：

```
src/{strings,styles,views,card,api}.js → esbuild → dist/client.js
package.json: main/client 指 dist，files 加 dist；CI 加 npm run build
```

会改动发布链路，需要连装一遍验证。**别在没验证的情况下改发布流程。**

### P0 · 给 14 个技能补「什么时候用」
本机实测缺条件：`office` 全家（8 个）、`drawai-canvas`、`drawai-video`、`diagram-design`、`ask-matt`、`diagnose-windows-sandbox-acl`、`grill-me`、`grill-with-docs`。这些是重活，最该被自动加载。改一条验一条再批量。

### P1 · 归类质量
- 「其他」组批量归（已有批量，但缺「只针对其他」的入口）
- 覆盖表分享：导入导出已做，缺「方案」概念（一套归类打包成可分享文件）

### P1 · 用量维度
- 按处境聚合（哪些处境真在用）
- 全量扫描结果落盘缓存（现在每次 1~8 秒）

### P2 · 开源卫生
- `.github/ISSUE_TEMPLATE/`、`CONTRIBUTING.md`
- release workflow（现在手动打 tag）
- 文案抽成 JSON（现在 zh/en 硬编码在 `client.js`）

### P2 · 其他
- 技能变更检测（新装/删除在面板上标出来）
- 自定义触发语编辑

---

## 11. 悬而未决（需要用户拍板）

1. **要不要把「技能优先」指令写进 `~/.dsh/AGENTS.md`**。这是让模型「开工前先查目录」的唯一杠杆，会改变所有会话的行为，所以一直没擅自动手。指令块文本已内置（诊断页一键复制）。
2. **`ask-matt` / `grill-me` / `grill-with-docs` 写的是 `disable-model-invocation: false`**（模型可调）。用户曾以为它们是手动型——如果要改成手动，改 frontmatter 的 `true` 即可，不是插件的事。
3. **npm 发布**：注册被 Cloudflare 拦（IP 120.235.66.148），用户说先放一边，只走 GitHub。
4. **Git push**：本机没有 git 凭据，`gh` 不在 PATH，推送需要用户处理。

---

## 12. 仓库约定

来自 `AGENTS.md`：

- Issue 走 GitHub Issues（`chandlernoidea/dsh-skill-dashboard`），用 `gh` CLI，见 `docs/agents/issue-tracker.md`
- 五个 triage 标签：`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`
- 单上下文文档：根目录一份 `GLOSSARY.md` + `docs/adr/`，见 `docs/agents/domain.md`
- 已有 ADR：`0001-read-only-by-design.md`

**用户偏好**：中文交流；要 UI 证据（截图）；讨厌空谈和"大概能用"；要求开源可维护，不能只考虑本机；问清楚再动手，但定了就一次做完。

---

## 13. 新会话开场提示词（可直接粘贴）

```
仓库 D:\00code\dsh\plug，是 DSH 插件 dsh-skill-dashboard。
先读 docs/HANDOFF.md，再跑 npm run check 确认状态。
今天的任务：从 §10 选一项做，先说清你打算怎么验证，再动手。
```

---

## 14. 快速索引

| 想知道 | 看这里 |
|---|---|
| 为什么手动型技能要 `/name` | §5.1 |
| 怎么数技能调用 | §5.2 |
| POST 为什么 405 | §5.3 |
| 插件消失了 | §3 |
| 怎么验证 | §8 |
| 下一步做什么 | §10 |
| 什么东西不该修 | §9 |
