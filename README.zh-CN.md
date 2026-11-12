[English](README.md) | 简体中文

# dsh-skill-dashboard

一个 [DeepSeek Harness](https://github.com/deepseek-ai) 插件：在右侧栏加一页 **技能**，一屏看全已安装的技能，标出只能点名调用的那些，并把触发语放到一次点击之外。

## 为什么需要它

技能散落在 `~/.dsh/skills`、项目的 `.dsh/skills`、插件包和运行时注册表里，装多了很容易忘记自己到底有什么。

声明了 `disable-model-invocation: true` 的技能是**故意**不进入模型技能目录的：模型调不动，硬调会报 `skill "..." is not available for model invocation`，而界面上没有任何地方告诉你这个技能叫什么。

这一页同时解决这两件事。

## 功能

- **一张清单看全所有技能**，按你想做的事分组（写代码 / 审代码 / 写文档 / 查证研究 / 设计出图 / 学习 / 维护 harness），而不是按来源仓库。
- **手动型技能带徽章**并附触发语；点「插入」把触发语追加到输入框，不发送，也不覆盖已有草稿。
- **搜索与筛选**：按名字或说明搜索，可只看需点名、只看有文件、只看注册表。
- **来源逐条可见**：归类表知道仓库地址就显示地址，否则显示文件路径，可复制。
- **数据实时**：读宿主的会话技能目录，用户技能、项目技能、随包技能、注册表技能都会出现；新装的技能 30 秒内自动出现。
- **界面上直接改归属**：点卡片上的「改归属」把技能换到别的分组，结果写进你的用户覆盖表，不改包内文件。
- **按需诊断**：点按钮才采集插件健康状态，给出一段可复制的纯文本报告。
- **调用统计**：本会话调用最多的技能及次数、从未被调用的数量；可手动切到「全部会话」扫历史。
- **跟随宿主语言**：宿主是中文就显示中文，否则英文。

## 环境要求

| 项目 | 说明 |
| --- | --- |
| DSH | `>=0.2.2-rc.1`，写在 `engines.dsh` 与 `dsh.compatibility` 里；更新的版本不会被拦。 |
| Node.js | 20 及以上，CI 用 22。 |
| 右侧栏 | 需要 `@deepseek-ai/dsh-client-ui-sidebar-right`，默认 Web profile 自带。 |

## 安装

从本地目录安装：

```js
plugin_manager({ action: 'install_bundle', target: 'D:/path/to/dsh-skill-dashboard' })
```

包发布到 npm 之后：

```js
plugin_manager({ action: 'install_bundle', target: 'dsh-skill-dashboard' })
```

启用 bundle 后重新加载窗口。

## 使用

入口是会话标题栏的 **技能** 按钮，或右侧栏 `+` → 开始 → 技能。

- 在搜索框输入名字或说明即可过滤。
- 用筛选胶囊把列表收窄到「需点名 / 有文件 / 仅注册表」。
- 手动型卡片上的 **插入** 会把触发语追加进输入框。
- **改归属** 把技能挪到别的分组，选择会写进你的覆盖表。
- **运行诊断** 采集插件健康状态，结果可直接贴进 issue。
- **调用情况** 显示本会话的调用统计，可切换到全部会话。

## 配置

### 包内归类表

分组、分组标题和触发语都在 [`taxonomy.json`](taxonomy.json) 里，是纯数据，改动不需要重新构建。

```json
{
  "situations": [{ "id": "code", "title": "写代码", "titleEn": "Write code", "order": 10 }],
  "skills": {
    "tdd": { "situation": "code" },
    "handoff": { "situation": "docs", "trigger": "用 handoff 把这次对话整理成交接文档" }
  }
}
```

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `situations[].title` / `titleEn` | 是 | 中文与英文分组标题 |
| `skills.<name>.situation` | 是 | 该技能属于哪个分组 |
| `skills.<name>.trigger` | 否 | 插入输入框的触发语；省略时用技能说明生成 |
| `skills.<name>.zh` | 否 | 中文界面下显示的中文说明 |
| `skills.<name>.repo` | 否 | 填了来源行会变成可复制的仓库地址 |

没收录的技能照常显示：按名字和说明推断分组并自动排序，什么都匹配不上时归入 **其他**。

```bash
node tools/check-taxonomy.mjs   # 校验归类表，CI 也会跑
```

### 用户覆盖表

把同结构的文件放到 `$DSH_HOME/skill-dashboard/taxonomy.json`（默认 `~/.dsh/skill-dashboard/taxonomy.json`），它会按技能名叠加在包内表上，你可以把机器上的技能归位而不用改包内文件。

```json
{ "skills": { "my-deploy-helper": { "situation": "harness" } } }
```

覆盖表能新增分组、修改技能，但**删不掉**包内已有条目。文件写坏时会被忽略，界面上会给出提示而不是空白。界面里的「改归属」就是写到这个文件。

## 实现结构

插件分两半：`index.js` 跑在宿主侧，注册 HTTP 路由；`client.js` 跑在浏览器侧，注册并渲染右侧栏 tab。数据整形逻辑是 `lib/compose.js` 里的纯函数，不依赖宿主即可测试。

| 路由 | 用途 |
| --- | --- |
| `GET /api/skill-dash/data` | 技能目录与归类表合并后的数据 |
| `GET /api/skill-dash/zh` | 当前目录对应的中文说明 |
| `GET /api/skill-dash/diagnose` | 插件健康报告 |
| `GET /api/skill-dash/usage` | 单个会话或全部会话的技能调用次数 |
| `POST /api/skill-dash/classify` | 把归类结果写进用户覆盖表 |
| `POST /api/skill-dash/exclude` | 把某个技能排除出统计 |

## 兼容性

- **平台**：Windows / macOS / Linux。代码里没有平台分支；目前只在 Windows 上实测过。
- **DSH 版本**：每个宿主能力都在运行时探测。能力缺失时给出说明缺了什么，而不是一片空白。
- 无遥测，不向任何地方上报使用数据。

## 非目标

插件**只读**：不安装、不卸载、不更新、不启停技能，详见 [ADR 0001](docs/adr/0001-read-only-by-design.md)。也不做「未安装技能」的浏览。

## 开发

```bash
npm run check   # 语法、归类表、打包清单、测试
npm test        # 只跑 node --test
```

`npm run check` 就是 CI（[`.github/workflows/check.yml`](.github/workflows/check.yml)）跑的那一套。

改 `index.js` 后要重载 bundle（`plugin_manager` 关再开），HMR 不会重新导入宿主模块；改 `client.js` 刷新页面即可。

### 发布

首次发布需要人工处理 GitHub 凭证、推送和 npm 登录，向导会一步步带你走：

```bash
bash scripts/publish-wizard.sh
```

## 参与

问题与需求提到 [GitHub Issues](https://github.com/chandlernoidea/dsh-skill-dashboard/issues)，欢迎 PR。

- 归类改动只改 JSON；JavaScript 改动需要在 `test/` 下补测试。
- 提 PR 前跑一遍 `npm run check`。

## 许可证

MIT，见 [LICENSE](LICENSE)。
