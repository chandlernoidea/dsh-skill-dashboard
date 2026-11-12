# 交接文档 · dsh-skill-dashboard

> 给接手的新会话看。读完这一份就能开工，不必重读历史对话。
> 最后更新：2026-11-12，用量、覆盖表与 Client 分片重构（工作区改动，未提交）。

---

## 0. 30 秒版

一个 DSH 插件：在右侧栏开一个「技能」面板，把当前会话能用的技能列出来，**分清哪些模型能自己调、哪些必须你写 `/名字`**，给出可直接复制的触发语；另有一个诊断页，管插件健康、调用统计、归类维护。

代码在 `D:\00code\dsh\plug`（仓库根就是包根），以软链接方式装进 `~/.dsh/profiles/desktop`。

**开工前三件事**：跑 `npm run check`；确认软链接没断（见 §3）；改动后按 §8 的流程重载验证。

---

## 1. 项目状态

- 版本 `0.1.0`，MIT，仓库 `https://github.com/chandlernoidea/dsh-skill-dashboard`
- 当前 25 个提交，工作区有未提交改动（用量、覆盖表、Client 分片、用量画像、模型翻译、方案预演/撤销、扫描缓存）
- 测试 89 个（`node --test`），全绿
- 发布 18 个文件，`npm pack` 直接发源码（安装时无构建；开发时 `npm run build` 由分片生成 `client.js`）
- 只读设计（ADR 0001）：只写用户自己的覆盖表，不动包内数据、不改技能文件
- 模型翻译是显式 opt-in（ADR 0002）：不点确认不发送；只发技能名/说明，不发对话

规模：

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/client/*.js` | 16 片 | Client 源码，最大单片 841 行；按文件名顺序拼成 `client.js` |
| `client.js` | 2706 | 生成物；宿主加载的单文件，不要手改 |
| `index.js` | 1030 | Host：路由、读插件、读用量、读写覆盖表、翻译、方案预演、变更检测 |
| `lib/compose.js` | 146 | 技能 → 处境归类（表优先，推断兜底） |
| `lib/usage.js` | 177 | 数技能调用 + 合成页面上的那组用量数字 |
| `lib/usage-cache.js` | 56 | 全量扫描的 60 秒磁盘缓存（完整扫描才缓存） |
| `lib/override.js` | 250 | 覆盖表的唯一读写入口（校验、串行写、坏文件备份、prune、撤销快照） |
| `lib/translate.js` | 280 | 模型翻译的 prompt / 流式解析 / 内容哈希缓存（只翻说明） |
| `lib/capabilities.js` | 57 | 宿主能力探测 |
| `lib/skills-snapshot.js` | 72 | 技能快照与新增/移除 diff（用户确认后才推进） |
| `taxonomy.json` | 203 | 8 个处境 + 45 条技能映射 |

---

## 2. 它解决什么问题

三个真实痛点：

1. **手动型技能是隐形的**。`disable-model-invocation: true` 的技能不进模型目录，模型不知道它存在；你不知道名字就永远用不上。面板直接把 `/名字` 摆出来。
2. **不知道装了什么、用没用**。45 个技能里今天调过哪几个、哪些装了从没用过。
3. **归类乱**。技能按处境分组（写代码 / 审代码 / 写文档 / 研究查证 / 设计出图 / 学习 / 维护 harness / 其他），可手动纠正。
4. **新手看不懂、不知道从哪下手**。说明是英文/术语；调用次数只有条形图，看不出「这个技能在替我干活」还是「它已经进了我的固定流程」。上手画像和 opt-in 翻译就是为这两件事做的。

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
| GET | `/api/skill-dash/usage` | 用量；`?scope=all` 扫最近 30 个会话（8 秒预算）；完整扫描缓存 60 秒 |
| GET | `/api/skill-dash/override` | 导出整份覆盖表 |
| POST | `/api/skill-dash/classify` | `{name}` 或 `{names:[...]}` + `{situation}`，一次写入 |
| POST | `/api/skill-dash/exclude` | `{name, excluded}`，加/移除统计黑名单 |
| POST | `/api/skill-dash/override/preview` | 预演一份覆盖表会改哪些归类 / 排除，不写盘 |
| POST | `/api/skill-dash/override/import` | 整表替换，校验形状，并保存上一份表供撤销 |
| POST | `/api/skill-dash/override/undo` | 恢复上一份覆盖表（只保留一级） |
| POST | `/api/skill-dash/override/prune` | 删除已移除技能的归类与统计排除；先存 undo |
| POST | `/api/skill-dash/translate/forget` | 清掉指定技能（或全部）的翻译缓存，让下次重翻 |
| POST | `/api/skill-dash/translate` | **必须带 `consent:true`**；用会话当前模型翻译技能说明，按内容哈希缓存 |
| POST | `/api/skill-dash/skills/ack` | 把当前技能目录写进快照，「新增/移除」标记到此确认 |

### 数据流

```
sessionSkillCatalog.list({sessionId})            → 技能清单（含 modelInvocable）
  ↓ readCatalogCached：同 session 500ms TTL + 并发 in-flight 合并
  ↓ 退路：sessions.scope(id) + skills.list({scope})
  ↓ 再退路：skills.list({})                      ← 只有全局，缺用户技能
composeDashboard({skills, taxonomy, override, language})
  ↓ 每条技能得 situation / situationSource('taxonomy'|'heuristic') / title / trigger
tallySkillUsage(events)                          → 单会话 tally
  ↓ 全部会话：同一函数逐会话跑，收集成 tallies
  ↓ usageCacheKey(会话列表) + 60 秒 TTL；完整扫描才写缓存
composeUsage(tallies, { excluded, partial })     → modelTotal / manualTotal / total / failed
  ↓
client 渲染技能页 + 诊断页；用量数字直接画，不再做加减
  ↓ 上手画像：auto / workflow / idle / failed；按处境：每组模型/手动/用过

覆盖表：readOverride / updateOverride / replaceOverride（lib/override.js）
  ↓ 唯一写入口：校验、串行、坏文件先备份成 taxonomy.json.corrupt-*
  ↓ 方案：preview → import（先保存 taxonomy.json.undo）→ undo

翻译：当前会话模型（agents.get(id).model.current()）+ ctx.llm.stream()
  ↓ prompt / 解析 / 缓存都在 lib/translate.js
  ↓ 只有 POST /translate 且 consent:true 才会发出；内容哈希命中则不再发

变更检测：readSkillsSnapshot / diffSkills（lib/skills-snapshot.js）
  ↓ /data 只读快照，不推进；只有 POST /skills/ack 才写
```

### 客户端结构

`client.js` 是宿主原样加载的单文件，**没有运行时打包器**，`import` 走不通。它由 `src/client/` 的 16 个分片按文件名顺序拼成（`npm run build`）：

```
00-loader → 10-strings → 20-helpers → 22-usage-view → 24-audit → 26-view-model
→ 27-usage-profile → 28-card → 29-diagnose → 30-styles → 31-starter → 32-data
→ 40-icons → 50-dashboard → 60-tab → 70-lifecycle
```

所有分片共享同一个 `factory(require)` 作用域；`50-dashboard` 只剩状态、事件和两个返回树（797 行），数据/中文说明轮询已提到 `useSkillCatalog`，用量推导/画像、触发体检、筛选/分组、卡片、诊断页、起步引导都已各有独立文件。改 Client 只改分片，`client.js` 是生成物；`npm run check` 会拦住忘记 build 的情况。细节见 `src/client/README.md`。

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

### 5.2.1 统计口径（别在别处做算术）

`lib/usage.js` 的 `composeUsage` 是唯一定义：`modelTotal`（模型调用）、`manualTotal`（`/name`）、`total = 两者之和`、`failed`（失败尝试，不计入任何 total）。被排除的技能名从**每一个**数字里一起扣掉。

历史 bug：诊断页把 `total − manualTotal` 当模型数，而 `total` 只算模型调用，于是出现负数。别再在路由或 Client 里做这类减法；Client 只画 payload 里的字段。

### 5.3 路由的两个限制

- `server.register({ resource })` **只接 GET/HEAD**，POST 会被框架挡成空体 405。写操作必须用 `{ handler }`（Node 的 req/res），自己读 body。两个写接口共用 `postJson()` 包装。
- 客户端 `styles` 内置模块**可能不存在**，必须走 `<style>` 注入兜底，否则面板白屏无样式。
- 写覆盖表**只走 `lib/override.js`**：`updateOverride` 负责校验、串行写（同文件 promise 链）、坏文件先备份；三个 POST 路由只做参数校验。别再在 `index.js` 里直接 `writeFile` + `rename`（历史上三份实现共用同一个 `.tmp`，并发会互相覆盖；坏 JSON 会被静默清空）。

### 5.4 面板滚动

容器要 `height:100%; overflow-y:auto`，光 `min-height:100%` 不会出滚动条（历史 bug）。

### 5.5 侧栏展开

`sidebarRight.openTab(kind)` 在栏目收起时是 no-op，必须先 `isExpanded()` / `toggleExpanded()`。

---

## 6. 功能清单（现状）

**技能页**：搜索、四个分类（全部 / 需点名 / 有文件 / 注册表 / 没写触发条件）+ **未使用**、按处境分组、卡片（描述、来源、"写进输入框"、"复制"、"改归属"、批量归类）。手动型卡片带「需点名」角标，描述没写触发条件的带「无触发」角标，新增技能带绿色「新」角标。**第一次用**（当前范围 0 次调用）时顶部出现“第一次用？从这里开始”：挑 3 个模型可调、有触发条件、还没用过的技能（优先不同处境），给「写进输入框」/「复制」，并直达翻译和诊断页。诊断页「按处境看」的每一行可点击，直接切到技能页并只看该处境。

**诊断页**：
- 插件健康（总数 / 活跃 / 停用 / 失败），**停用和失败都列具体名字**
- 宿主能力、归类表版本
- 触发体检：描述里没有「什么时候用」的可调技能 + 一键复制「技能优先」指令块
- **上手画像**：把技能分成「自动运转 / 你的工作流 / 还没用上 / 试过但没跑通」，各带数量和前几个名字；解释「自动多 = 它在替你干活，手动多 = 它进了你的固定流程」
- **按处境看**：每个处境一行，模型/手动次数 + 用过的技能数/总数；全 0 的处境一眼可见
- 调用统计，**模型自动调用 / 手动 `/name` 两条独立的黄色条形**，明细表双列，可切「本会话 / 全部会话」；失败次数单独一行，超时扫描标「只扫了 N/M」，扫不了历史时说明原因而不是显示 0
- 未调用按处境分组展开；**模型调用或手动调用任一发生过都算用过**
- **技能变更检测**：与上次确认的快照比较，顶部列出新增/移除的技能，卡片带「新」角标；点「知道了」才推进快照，30 秒轮询不会把标记刷掉。移除的技能可以顺手「清理已移除的覆盖项」
- 归类表导入 / 导出；导入前**先预览变更**（哪些技能改处境、哪些加/减统计排除），应用后可**撤销上一次方案**
- 统计黑名单（`⊘` 排除，点名字恢复）

**模型翻译（可选）**：只在**中文界面**出现「技能说明还是英文的」横幅 + **一键汉化**（英文界面卡片不使用中文译文，所以不提供入口，避免白花 token）。第一次点弹确认面板（多少条、多少字、哪个模型），勾「记住选择」后再次点击直接发送；只发技能名/说明/whenToUse，不发对话。**只替换英文说明，不改技能名**（`/name` 要用原名）。每批 4 条、输出上限 4096、自动选最低推理档位；遇到 `max-tokens/length` 截断会自动对半重试；某一批失败会继续跑剩余批次，最后返回「已翻译 N 条，还有 M 条未完成」。译文按原文哈希缓存；卡片上的「重译」会先清掉该条缓存再请求。

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

写入一律走 `lib/override.js`：唯一临时文件名 + 同文件串行 + rename；读不出来的旧表先备份成 `taxonomy.json.corrupt-<时间戳>-<序号>`，再以空表继续。页面会提示备份路径。

### 撤销快照 `~/.dsh/skill-dashboard/taxonomy.json.undo`
每次导入覆盖表前保存上一份表；撤销后删除。只保留一级，下一次导入覆盖它。

### 翻译缓存 `~/.dsh/skill-dashboard/translations.json`

```json
{ "tdd": { "hash": "…16 位…", "zh": "测试驱动开发…" } }
```
`hash` 由技能名 + description + whenToUse 算出；只有 `consent:true` 的翻译请求会写这里。旧缓存里即使有 `title` 也不会显示。缓存坏了就当没有；写入走唯一临时文件 + 同文件串行。没有对话内容，也没有技能正文。

### 扫描缓存 `~/.dsh/skill-dashboard/usage-cache.json`
`{ key, at, tallies }`。`key` 是最近 30 个会话的 id + 版本字段；只有**完整**扫描才写入，TTL 60 秒。超时/部分扫描绝不缓存，避免把半套数字固定下来。

### 技能快照 `~/.dsh/skill-dashboard/skills-snapshot.json`
`{ version, at, skills: [{ name, source, path }] }`。`/data` 只读它做 `added/removed` diff，**不推进**；只有「知道了」的 POST 才写。首次运行或快照损坏时静默初始化，不会把整份目录报成新增。

---

## 8. 验证流程（每次改完都要走）

```bash
cd /d/00code/dsh/plug
npm run build          # 改过 src/client/ 之后：拼回 client.js
npm run check          # 分片同步 + 语法 + 归类表 + 打包清单 + 89 用例

# 在 DSH 的沙箱里 node --test 会 spawn EPERM，改用：
node --test --test-isolation=none
```

翻译相关**不要**在开发验证里真发模型请求（会花用户 token）。路由用假 `ctx` + 假 `llm.stream` 覆盖：没有 `consent:true` 必须 400、内容哈希命中不再调用、缓存命中后 `/data` 能带回译文。

加载到界面：

```
plugin_manager set_bundle enabled:false target:dsh-skill-dashboard   # 重载 host
plugin_manager set_bundle enabled:true  target:dsh-skill-dashboard
```

然后浏览器刷新（`Ctrl+R`），点侧栏「技能」。

**接口可以直接 curl**（比截图快；端口以运行时 URL 为准，本机这次是 8751）：

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
3. **用量只覆盖能被读到的会话日志**；全量扫描最多 30 个会话、8 秒预算。超时或读不出的会话会在 payload 里标 `partial`，界面显示「只扫了 N/M」；`sessionQuery` 缺失时 `available:false`，界面说明原因，不假装 0。
4. **`client.js` 是生成物**：源码在 `src/client/`（无运行时打包器，靠 `scripts/build-client.mjs` 顺序拼接）。不要直接改 `client.js`；`npm run check` 的 build 校验会拦住分片与生成物不一致的情况。
5. **模型翻译**：只在用户点确认后发出，且只在中文界面提供入口；每批 4 个技能、单次最多 24 个、30 秒总超时；自动选最低推理档位；截断自动对半重试；单批失败会继续跑后续批次。翻译质量取决于当前模型，插件不做二次校对。
6. **方案只动覆盖表**：PULSE 的自动配装会移动/启停文件，本插件按 ADR 0001 只改归类与统计排除；撤销只保留一级。
7. **`client.js` 的单片仍偏大**（`50-dashboard.js` 797 行），但数据/中文说明轮询已提到 `useSkillCatalog`；下一步可继续拆诊断/用量资源。
8. **归类对陌生用户是猜的**：包内 45 条是本机的，别人靠关键词推断。
9. **全量用量缓存 60 秒**：同一会话在 60 秒内新增的调用可能暂时不计入「全部会话」；切回本会话或等 TTL 后刷新即可。部分扫描不写缓存。
10. **技能快照只按名字 diff**：同名技能换路径/来源不算新增；只有「知道了」推进快照，目录读空时不推进。
11. **目录缓存 500ms**：`/data`、`/zh`、`/diagnose` 共用；刚装的技能最多延迟 500ms 出现，换来面板打开时只读一次目录。

---

## 10. 待办路线图

**已完成（2026-11-12）**：用量收成单一 module（`composeUsage`）；覆盖表收成单写入口（`lib/override.js`），坏文件先备份；Client 拆成 `src/client/` 16 个分片，数据轮询提到 `useSkillCatalog`，补上「加载 + 两个视图渲染」的 smoke test + 11 个路由集成用例；上手画像；按处境聚合；全量扫描 60 秒缓存；模型一键汉化（只替换说明，中文界面，截断/失败分批恢复，单条重译）；覆盖表方案预演 / 应用 / 撤销 / 清理已移除技能；第一次用的三步起步引导；技能新增/移除检测；未使用筛选 + 处境下钻。

### P0 · client.js 继续瘦身
`src/client/` 的分片 + `scripts/build-client.mjs` 零依赖拼接已经落地，`client.js` 仍是宿主加载的单文件，发布链不变。最大单片是 `50-dashboard.js`（797 行）；数据/中文说明已提成 `useSkillCatalog`，下一步可把 `diag` / `usageAll` 两套资源也提成 hook，或引入真正的模块化（esbuild）——后者要连装验证，**别在没跑校验时重载**。

### P0 · 给 14 个技能补「什么时候用」
本机实测缺条件：`office` 全家（8 个）、`drawai-canvas`、`drawai-video`、`diagram-design`、`ask-matt`、`diagnose-windows-sandbox-acl`、`grill-me`、`grill-with-docs`。这些是重活，最该被自动加载。改一条验一条再批量。

### P1 · 归类质量
- 「其他」组批量归（已有批量，但缺「只针对其他」的入口）
- 覆盖表分享：导入导出已做，缺「方案」概念（一套归类打包成可分享文件）
- **新手起步方案**：内置一份「先试这几个 / 这些从没触发」的只读方案，套用前先预览（PULSE 的 preview/apply 模式已经用在导入上，可以复用）

### P1 · 用量维度
- 按周/趋势看「自动 vs 手动」比例，判断工作流是否形成
- 超过 30 个会话时做增量/分段读取（现在只取最近 30 个）

### P2 · 新手引导
- 首次打开的三步清单：试一个技能、修一条无触发描述、复制「技能优先」指令
- 自定义触发语编辑

### P2 · 开源卫生
- `.github/ISSUE_TEMPLATE/`、`CONTRIBUTING.md`
- release workflow（现在手动打 tag）
- 文案抽成 JSON（现在 zh/en 硬编码在 `client.js`）

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
- 已有 ADR：`0001-read-only-by-design.md`、`0002-opt-in-model-translation.md`

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
| 用量数字怎么算 | §5.2.1 |
| 覆盖表写坏了怎么办 | §5.3 |
| POST 为什么 405 | §5.3 |
| 插件消失了 | §3 |
| 怎么验证 | §8 |
| 下一步做什么 | §10 |
| 什么东西不该修 | §9 |
