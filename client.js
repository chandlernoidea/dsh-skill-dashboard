window.__ModuleLoader__.load({
  id: 'dsh-skill-dashboard',
  factory(require) {
    // One file by necessity: the host serves this module as-is, with no bundler
    // between the package and the browser. Sections, in order:
    //   1. routes + constants
    //   2. STRINGS_ZH / STRINGS_EN dictionaries
    //   3. pure helpers (language, firstSentence, triggerFor, originFor)
    //   4. installStyles — the whole `.sd-*` stylesheet, injected once
    //   5. the tab-type registration (body + title + header button)
    //   6. Dashboard: state, writers (classify / exclude / import), derived data
    //   7. renderDiagnose — plugin health, usage table, override import/export
    //   8. renderCard + the skills list
    // Anything worth sharing with the host lives in lib/ instead.
    const React = require('react')
    const h = React.createElement

    const TAB_ID = 'dsh-skill-dashboard'
    const TAB_KIND = 'skill-dashboard'
    const ROUTE = '/api/skill-dash/data'
    const ZH_ROUTE = '/api/skill-dash/zh'
    const DIAG_ROUTE = '/api/skill-dash/diagnose'
    const USAGE_ROUTE = '/api/skill-dash/usage'
    const CLASSIFY_ROUTE = '/api/skill-dash/classify'
    const EXCLUDE_ROUTE = '/api/skill-dash/exclude'
    const OVERRIDE_ROUTE = '/api/skill-dash/override'
    const OVERRIDE_IMPORT_ROUTE = '/api/skill-dash/override/import'
    const OVERRIDE_PRUNE_ROUTE = '/api/skill-dash/override/prune'
    const OVERRIDE_PREVIEW_ROUTE = '/api/skill-dash/override/preview'
    const OVERRIDE_UNDO_ROUTE = '/api/skill-dash/override/undo'
    const TRANSLATE_ROUTE = '/api/skill-dash/translate'
    const TRANSLATE_FORGET_ROUTE = '/api/skill-dash/translate/forget'
    const SKILLS_ACK_ROUTE = '/api/skill-dash/skills/ack'
    const FALLBACK_SITUATIONS = [{ id: 'other', title: '其他', order: 999 }]

    // ------------------------------------------------------------------ i18n
    const STRINGS_ZH = {
          tab: '技能',
          open: '技能上手台',
          guideDesc: '看全部技能、点名型触发语和调用统计',
          eyebrow: 'SKILL DASHBOARD',
          title: '技能上手台',
          search: '搜技能名或说明…',
          all: '全部',
          manual: '需点名',
          files: '有文件',
          registry: '注册表',
          refresh: '刷新',
          copy: '复制',
          copied: '已复制',
          exportFailed: '导出失败：',
          insert: '写进输入框',
          inserted: '已写入',
          howto: '怎么说',
          badgeManual: '需点名',
          badgeAuto: '模型可调',
          total: '合计',
          loading: '正在读取技能目录…',
          empty: '没有匹配的技能',
          emptyHint: '换个关键词，或把筛选切回「全部」。',
          error: '读取失败',
          retry: '重试',
          manualBannerTitle: '这些技能默认不上架',
          manualBannerBody: '这些技能不进模型目录，只有你在消息里写 /技能名 才会加载。点「需点名」只看它们，右边一键把 /名字 写进输入框。',
          subtitle: (total, manual) => `${total} 个技能 · ${manual} 个只能点名`,
          stale: '刷新失败，显示的是上次结果',
          unmapped: '没收录进 taxonomy，先归到「其他」——欢迎去仓库提 PR 把它归位。',
          auto: '自动归类',
          origin: '来源',
          registryOrigin: '运行时注册，没有文件',
          copyOrigin: '复制来源',
          insertFailed: '写不进输入框，已复制',
          noSession: '拿不到当前会话',
          plugins: '插件',
          pluginActive: '活跃',
          pluginFailed: '失败',
          pluginDisabled: '停用',
          failedList: '插件失败',
          diagExpand: '展开诊断',
          diagCollapse: '收起',
          diagEmpty: '没有诊断文本',
          diagMore: (n) => `另有 ${n} 个`,
          diagnose: '开始诊断',
          rediagnose: '重新诊断',
          diagnosing: '诊断中…',
          copyReport: '复制报告',
          diagFailed: '诊断失败',
          scanning: '扫描中…',
          scopeAll: '统计全部会话',
          scopeSession: '只看本会话',
          unusedSession: '本会话未调用',
          unusedAll: '历史未调用',
          allSessions: '全部会话',
          viewSkills: '技能',
          viewDiagnose: '诊断',
          usageTitle: '调用情况',
          profileTitle: '上手画像',
          profileAuto: '自动运转',
          profileWorkflow: '你的工作流',
          profileIdle: '还没用上',
          profileFailed: '试过但没跑通',
          profileHint: '自动运转 = 模型自己加载；工作流 = 你习惯用 /名字 点名。自动多说明它在替你干活，手动多说明它已经进了你的固定流程。',
          situationUsageTitle: '按处境看',
          situationUsageHint: '前面是模型/手动调用次数，后面是「用过的技能 / 这组技能数」。全 0 的处境说明这组还没开始。',
          starterTitle: '第一次用？从这里开始',
          starterBody: '这几个技能模型能自己选中、也写了什么时候用，而且你还没试过。先挑一个写进输入框；说明看不懂就翻译；想让模型以后自己挑，去诊断页复制「技能优先」指令。',
          starterRule: '去复制「技能优先」',
          starterOpen: '再看一次新手引导',
          changesTitle: '技能有变化',
          changesAdded: (n) => `新增 ${n} 个：`,
          changesRemoved: (n) => `移除 ${n} 个：`,
          changesAck: '知道了',
          pruneRemoved: '清理已移除的覆盖项',
          pruneDone: '已清理已移除技能的覆盖项',
          pruneFailed: '清理失败：',
          badgeNew: '新',
          translate: '翻译说明',
          retranslate: '重译',
          translateOneClick: '一键汉化',
          translateBannerTitle: '技能说明还是英文的',
          translateBannerBody: (n, model) => `有 ${n} 条说明没有中文。点一下用 ${model} 翻译；只发技能名和说明，会消耗 token。`,
          translateRemember: '记住选择，以后点「一键汉化」不再确认',
          translateTitle: '用模型翻译技能说明',
          translateBody: (count, chars, model) => `将把 ${count} 条英文说明发送到 ${model}（约 ${chars} 字）。`,
          translatePrivacy: '只发送技能名和说明，不发送对话内容；每次是一小段请求，会消耗你账户的 token。',
          translateStart: '开始翻译',
          translateCancel: '取消',
          translating: '翻译中…',
          translateDone: (n) => `已翻译 ${n} 条并缓存`,
          translatePartial: (done, left) => `已翻译 ${done} 条，还有 ${left} 条未完成，可再点一次`,
          translateNone: '没有需要翻译的说明',
          translateFailed: '翻译失败：',
          translateModelUnknown: '当前会话模型',
          showUnused: '展开未调用',
          hideUnused: '收起未调用',
          justNow: '刚刚',
          minutesAgo: (n) => `${n} 分钟前`,
          hoursAgo: (n) => `${n} 小时前`,
          daysAgo: (n) => `${n} 天前`,
          capabilitiesLabel: '宿主能力',
          capabilitiesAll: '齐全',
          taxonomyLabel: '归类表',
          classify: '改归属',
          closeClassify: '取消',
          classifyFailed: '改归类失败：',
          batchStart: '批量归类',
          pickOne: '选中',
          batchCancel: '退出批量',
          batchPicked: (n) => `已选 ${n} 个，选一个处境应用`,
          batchApplied: '已应用',
          batchFailed: '批量归类失败：',
          exportOverride: '导出归类表',
          importOverride: '导入归类表',
          importApply: '应用',
          importCancel: '取消',
          importFailed: '导入失败：',
          previewPlan: '预览变更',
          resetPlan: '恢复默认归类',
          previewEmpty: '这个方案不会改变任何归类。',
          previewChanges: (n) => `会改变 ${n} 个技能的归类：`,
          previewExcludeAdded: (n) => `新增 ${n} 个统计排除：`,
          previewExcludeRemoved: (n) => `恢复 ${n} 个统计：`,
          applyPlan: '应用这个方案',
          applyDone: '方案已应用，可撤销',
          undoPlan: '撤销上一次方案',
          undoDone: '已恢复上一次方案',
          undoNone: '没有可撤销的方案，或撤销失败',
          exported: '已复制归类表 JSON',
          disabledList: '停用',
          excludeSkill: '不计入统计',
          includeSkill: '恢复统计',
          namedCol: '点名',
          usageModel: '模型自动调用',
          usageManual: '手动调用 /name',
          times: ' 次',
          usageNone: '还没有',
          colModel: '模型',
          colManual: '手动',
          namedHint: '「点名」= 这次调用前，最近一条用户消息里出现了技能名（推断，非记录）',
          excludedLine: (n) => `已排除统计 ${n} 个，点名字恢复：`,
          excludedFailed: '改排除失败：',
          auditTitle: '触发体检',
          vague: '模型调用/手动',
          unusedFilter: '未使用',
          situationFilterLabel: '只看处境：',
          clearFilter: '看全部',
          badgeVague: '手动触发',
          auditBody: (n) => `${n} 个可调技能的描述里没有「什么时候用」，模型匹配不上，等于隐形。`,
          auditGood: '所有可调技能的描述都写了使用条件。',
          copyRule: '复制「技能优先」指令',
          ruleCopied: '已复制指令块',
          partialScan: (done, total) => `只扫了 ${done}/${total} 个会话`,
          sessionLabel: '本会话',
          sessionEmpty: '还没调用过技能',
          usageFailed: (n) => `${n} 次调用失败`,
          usageUnavailable: '历史会话读取不可用',
          backupNotice: '覆盖表原来读不出来，旧内容已备份到：',
          noDataTitle: '读不到技能清单',
          noDataBody: '当前 DSH 缺少这些能力：',
          versionHint: '多半是 DSH 版本不匹配——插件依赖的宿主服务在这个版本里不存在。',
    }

    const STRINGS_EN = {
          tab: 'Skills',
          open: 'Skill dashboard',
          guideDesc: 'Every skill, its name-only trigger, and usage.',
          eyebrow: 'SKILL DASHBOARD',
          title: 'Skill dashboard',
          search: 'Search name or description…',
          all: 'All',
          manual: 'Name-only',
          files: 'On disk',
          registry: 'Registry',
          refresh: 'Refresh',
          copy: 'Copy',
          copied: 'Copied',
          exportFailed: 'Export failed: ',
          insert: 'Insert',
          inserted: 'Inserted',
          howto: 'Say',
          badgeManual: 'Name it',
          badgeAuto: 'Model',
          total: 'All',
          loading: 'Reading the skill catalog…',
          empty: 'No skill matches',
          emptyHint: 'Try another keyword, or switch the filter back to All.',
          error: 'Failed to load',
          retry: 'Retry',
          manualBannerTitle: 'These stay out of the model catalog',
          manualBannerBody: 'They stay out of the model catalog. Type /name in a message to load one — the button on the right writes it into the composer.',
          subtitle: (total, manual) => `${total} skills · ${manual} name-only`,
          stale: 'Refresh failed, showing the last result',
          unmapped: 'Not in taxonomy yet, shown under Other — a PR is welcome.',
          auto: 'auto',
          origin: 'Origin',
          registryOrigin: 'Registered at runtime, no file',
          copyOrigin: 'Copy origin',
          insertFailed: 'Could not write the composer; copied instead',
          noSession: 'No current session',
          plugins: 'Plugins',
          pluginActive: 'active',
          pluginFailed: 'failed',
          pluginDisabled: 'disabled',
          failedList: 'Failed plugins',
          diagExpand: 'Show diagnostics',
          diagCollapse: 'Hide',
          diagEmpty: 'No diagnostic text',
          diagMore: (n) => `${n} more`,
          diagnose: 'Run diagnostics',
          rediagnose: 'Run again',
          diagnosing: 'Running…',
          copyReport: 'Copy report',
          diagFailed: 'Diagnostics failed',
          scanning: 'Scanning…',
          scopeAll: 'All sessions',
          scopeSession: 'This session',
          unusedSession: 'unused in this session',
          unusedAll: 'never called',
          allSessions: 'All sessions',
          viewSkills: 'Skills',
          viewDiagnose: 'Diagnostics',
          usageTitle: 'Calls',
          profileTitle: 'How you use skills',
          profileAuto: 'Auto-running',
          profileWorkflow: 'Your workflow',
          profileIdle: 'Not used yet',
          profileFailed: 'Tried but failed',
          profileHint: 'Auto-running means the model loads it; workflow means you name it with /name. Lots of auto calls mean the skill works for you; lots of manual calls mean it is part of your routine.',
          situationUsageTitle: 'By situation',
          situationUsageHint: 'Model/manual calls, then used skills / all skills in the group. An all-zero group has not started yet.',
          starterTitle: 'First time here? Start with this',
          starterBody: 'These skills can be chosen by the model, say when to use them, and have not been tried yet. Insert one into the composer, translate the description if it is hard to read, then copy the "skills first" rule from Diagnostics so the model starts looking them up.',
          starterRule: 'Copy the "skills first" rule',
          starterOpen: 'Open the starter guide again',
          changesTitle: 'Skills changed',
          changesAdded: (n) => `${n} new: `,
          changesRemoved: (n) => `${n} removed: `,
          changesAck: 'Got it',
          pruneRemoved: 'Prune removed skills',
          pruneDone: 'Removed-skill overrides pruned',
          pruneFailed: 'Prune failed: ',
          badgeNew: 'new',
          translate: 'Translate',
          retranslate: 'Retranslate',
          translateOneClick: 'Translate all',
          translateBannerTitle: 'Some descriptions are still English',
          translateBannerBody: (n, model) => `${n} descriptions have no Chinese yet. One click translates them with ${model}; only names and descriptions are sent and it spends tokens.`,
          translateRemember: 'Remember this choice; future "Translate all" clicks skip the confirmation',
          translateTitle: 'Translate skill descriptions with your model',
          translateBody: (count, chars, model) => `Send ${count} English descriptions to ${model} (about ${chars} characters).`,
          translatePrivacy: 'Only skill names and descriptions are sent — never the conversation. Each batch is a short request and spends tokens on your account.',
          translateStart: 'Start translating',
          translateCancel: 'Cancel',
          translating: 'Translating…',
          translateDone: (n) => `Translated ${n} and cached`,
          translatePartial: (done, left) => `Translated ${done}; ${left} still pending — click again to continue`,
          translateNone: 'Nothing needs translating',
          translateFailed: 'Translation failed: ',
          translateModelUnknown: 'the current session model',
          showUnused: 'Show uncalled',
          hideUnused: 'Hide uncalled',
          justNow: 'just now',
          minutesAgo: (n) => `${n}m ago`,
          hoursAgo: (n) => `${n}h ago`,
          daysAgo: (n) => `${n}d ago`,
          capabilitiesLabel: 'Capabilities',
          capabilitiesAll: 'all present',
          taxonomyLabel: 'Taxonomy',
          classify: 'Reclassify',
          closeClassify: 'Cancel',
          classifyFailed: 'Reclassify failed: ',
          batchStart: 'Batch classify',
          pickOne: 'Select',
          batchCancel: 'Exit batch',
          batchPicked: (n) => `${n} selected — pick a situation`,
          batchApplied: 'Applied',
          batchFailed: 'Batch classify failed: ',
          exportOverride: 'Export table',
          importOverride: 'Import table',
          importApply: 'Apply',
          importCancel: 'Cancel',
          importFailed: 'Import failed: ',
          previewPlan: 'Preview changes',
          resetPlan: 'Reset grouping',
          previewEmpty: 'This plan changes no grouping.',
          previewChanges: (n) => `Changes the grouping of ${n} skills: `,
          previewExcludeAdded: (n) => `Excludes ${n} more from stats: `,
          previewExcludeRemoved: (n) => `Counts ${n} back in: `,
          applyPlan: 'Apply this plan',
          applyDone: 'Plan applied — you can undo it',
          undoPlan: 'Undo the last plan',
          undoDone: 'Restored the previous plan',
          undoNone: 'Nothing to undo, or the undo failed',
          exported: 'Table JSON copied',
          disabledList: 'Disabled',
          excludeSkill: 'Skip in stats',
          includeSkill: 'Count again',
          namedCol: 'Named',
          usageModel: 'Model-invoked',
          usageManual: 'Manual /name',
          times: ' calls',
          usageNone: 'none yet',
          colModel: 'model',
          colManual: 'manual',
          namedHint: '"Named" means the turn\'s user message mentioned the skill before the call — a heuristic, not a recorded fact.',
          excludedLine: (n) => `${n} excluded from stats — click a name to restore: `,
          excludedFailed: 'Exclude failed: ',
          auditTitle: 'Trigger audit',
          vague: 'No trigger',
          unusedFilter: 'Unused',
          situationFilterLabel: 'Situation: ',
          clearFilter: 'Show all',
          badgeVague: 'no trigger',
          auditBody: (n) => `${n} invocable skills never say when to use them — the model cannot match them.`,
          auditGood: 'Every invocable skill states its usage condition.',
          copyRule: 'Copy the "skills first" rule',
          ruleCopied: 'Rule copied',
          partialScan: (done, total) => `scanned ${done}/${total} sessions`,
          sessionLabel: 'This session',
          sessionEmpty: 'No skill call yet in this session',
          usageFailed: (n) => `${n} failed calls`,
          usageUnavailable: 'History scan unavailable',
          backupNotice: 'The override table was unreadable; its old content was saved to: ',
          noDataTitle: 'Cannot read the skill catalog',
          noDataBody: 'This DSH is missing:',
          versionHint: 'Most likely a DSH version mismatch — a host service this plugin needs is absent from this build.',
    }

    function stringsFor(language) {
      return /^zh/i.test(language || '') ? STRINGS_ZH : STRINGS_EN
    }

    function activeLanguage() {
      try {
        const snapshot = hostCtx?.get?.('locale')?.getSnapshot?.()
        if (snapshot && typeof snapshot.active === 'string' && snapshot.active) return snapshot.active
      } catch (error) {
        /* no locale service: fall back to the browser */
      }
      return typeof navigator !== 'undefined' ? navigator.language || '' : ''
    }

    // --------------------------------------------------------------- helpers
    function firstSentence(text) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim()
      // Chinese sentences end with a full-width stop and usually no space, so
      // the old `[.。!！?？]\s` pattern never split them.
      const cut = clean.split(/[。！？!?]\s*|\.\s+/)[0]
      return (cut || clean).slice(0, 120)
    }

    function triggerFor(skill, language) {
      // A model-disabled skill can only be reached by a `/name` token in the
      // user's message, so that is the only trigger worth copying.
      if (skill.modelInvocable === false) return `/${skill.name}`
      if (skill.trigger) return skill.trigger
      const desc = firstSentence(skill.whenToUse || skill.description)
      const isZh = /^zh/i.test(language || '')
      return isZh ? `用 ${skill.name} 技能：${desc || '按你说的来'}` : `Use the ${skill.name} skill: ${desc || 'as described'}`
    }

    function originFor(skill) {
      if (skill.repo) return skill.repo
      if (skill.path) return skill.path
      return ''
    }

    function appendText(draft, text) {
      if (!draft) return text
      if (/\s$/.test(draft)) return draft + text
      return draft + ' ' + text
    }

    // The consent panel is shown once; the user can remember it and get a
    // genuinely one-click "translate" button afterwards. Stored in the web
    // client, not in the plugin's files.
    const TRANSLATE_CONSENT_KEY = 'dsh-skill-dashboard:translate-consent'

    function rememberedTranslateConsent() {
      try {
        return localStorage.getItem(TRANSLATE_CONSENT_KEY) === '1'
      } catch (error) {
        return false
      }
    }

    function rememberTranslateConsent() {
      try {
        localStorage.setItem(TRANSLATE_CONSENT_KEY, '1')
      } catch (error) {
        /* private mode or no storage: the panel simply shows again */
      }
    }

    async function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch (error) {
        /* fall through */
      }
      return false
    }

    // ------------------------------------------------------------- usage view

    // One derivation for every number the usage section shows. It used to be
    // inline in the Dashboard, which made it untestable and let `total` and
    // `manualTotal` drift into the negative-number bug.
    function deriveUsageView(activeUsage) {
      const usageBySkill = (activeUsage && activeUsage.byName) || {}
      const manualUsage = (activeUsage && activeUsage.manualByName) || {}
      const usedNames = new Set([...Object.keys(usageBySkill), ...Object.keys(manualUsage)])
      const modelCalls = (activeUsage && activeUsage.modelTotal) || 0
      const manualTotal = activeUsage && typeof activeUsage.manualTotal === 'number'
        ? activeUsage.manualTotal
        : Object.values(manualUsage).reduce((sum, count) => sum + count, 0)
      const failedCalls = (activeUsage && activeUsage.failed) || 0
      const usageUnavailable = Boolean(activeUsage) && activeUsage.available === false
      const partialScan = Boolean(activeUsage) && activeUsage.partial === true
      const topSkills = Object.entries(usageBySkill)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      const topMax = topSkills.length > 0 ? topSkills[0][1] : 1
      const topManual = Object.entries(manualUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      const manualMax = topManual.length > 0 ? topManual[0][1] : 1
      return {
        usageBySkill,
        manualUsage,
        usedNames,
        modelCalls,
        manualTotal,
        failedCalls,
        usageUnavailable,
        partialScan,
        topSkills,
        topMax,
        topManual,
        manualMax,
      }
    }
    // ------------------------------------------------------------ trigger audit

    // A description that never says when to use it cannot win a match.
    const WHEN_MARKERS = /(use when|when the user|use for|use before|when working|用于|适合|当.{0,6}时|时使用)/i

    const RULE_SNIPPET = [
      "## 技能优先",
      "",
      "开工前先看会话里的技能目录：只要某个技能的名字或描述命中当前任务，先用 `skill` 工具加载它，再动手。",
      "",
      "- 命中就加载，不要凭印象模仿它的做法。",
      "- 手动型技能不在目录里，只有用户写 `/名字` 时才加载，不要尝试替用户调用。",
      "- 加载后按它的流程走；与仓库约定冲突时以仓库约定为准，并说明冲突在哪。",
    ].join("\n")

    function isVagueSkill(skill) {
      // Manual-only skills are reached by `/name`, not by description matching.
      if (skill.modelInvocable === false) return false
      const text = (skill.description || '') + ' ' + (skill.whenToUse || '')
      return !WHEN_MARKERS.test(text)
    }

    function triggerAudit(skills) {
      const vagueSkills = (skills || []).filter(isVagueSkill)
      return { vagueSkills, vagueSet: new Set(vagueSkills.map((skill) => skill.name)) }
    }
    // ------------------------------------------------------------- view model

    function filterSkills(skills, query, mode, vagueSet, situation = '', usedNames = null) {
      const needle = String(query || '').trim().toLowerCase()
      return (skills || []).filter((skill) => {
        if (situation && skill.situation !== situation) return false
        if (needle) {
          const haystack = `${skill.name} ${skill.description} ${skill.whenToUse} ${skill.situation}`.toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        if (mode === 'manual') return skill.modelInvocable === false
        if (mode === 'files') return Boolean(skill.path)
        if (mode === 'registry') return !skill.path
        if (mode === 'vague') return vagueSet.has(skill.name)
        if (mode === 'unused') return usedNames === null ? true : !usedNames.has(skill.name)
        return true
      })
    }

    function groupSkills(skills, situations) {
      const buckets = new Map()
      for (const skill of skills) {
        const key = skill.situation || 'other'
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key).push(skill)
      }
      return situations
        .filter((situation) => buckets.has(situation.id))
        .map((situation) => ({ ...situation, items: buckets.get(situation.id) }))
    }

    function groupUnused(skills, usedNames, situations) {
      const unusedSkills = skills.filter((skill) => !usedNames.has(skill.name))
      const titles = {}
      for (const situation of situations) titles[situation.id] = situation.title
      const unusedGroups = []
      for (const skill of unusedSkills) {
        const key = skill.situation || 'other'
        let group = unusedGroups.find((entry) => entry.id === key)
        if (group === undefined) {
          group = { id: key, title: titles[key] || key, names: [] }
          unusedGroups.push(group)
        }
        group.names.push(skill.name)
      }
      return { unusedSkills, unusedGroups }
    }

    function buildChips(T, counts, vagueCount, unusedCount = 0) {
      return [
        { value: 'all', label: T.all, count: counts.total },
        { value: 'manual', label: T.manual, count: counts.manual, chip: 'manual' },
        { value: 'files', label: T.files, count: counts.files },
        { value: 'registry', label: T.registry, count: counts.registry },
        { value: 'vague', label: T.vague, count: vagueCount, chip: 'vague' },
        { value: 'unused', label: T.unusedFilter, count: unusedCount },
      ]
    }
    // ---------------------------------------------------------- usage profile

    // A beginner cannot read a bar chart and know what to do. This turns the
    // same counts into four plain states:
    //   auto     — the model chooses it; the skill is doing work on its own
    //   workflow — the user names it; it has become part of a habit
    //   idle     — installed, never used in the current scope
    //   failed   — tried, but every attempt was refused
    function classifyUsage(usage, skills) {
      const byName = (usage && usage.byName) || {}
      const manualByName = (usage && usage.manualByName) || {}
      const failedByName = (usage && usage.failedByName) || {}
      const items = (skills || []).map((skill) => {
        const model = byName[skill.name] ?? 0
        const manual = manualByName[skill.name] ?? 0
        const failed = failedByName[skill.name] ?? 0
        let kind = 'idle'
        if (model > 0 || manual > 0) kind = model >= manual ? 'auto' : 'workflow'
        else if (failed > 0) kind = 'failed'
        return { name: skill.name, model, manual, failed, kind }
      })
      const pick = (kind) => items.filter((item) => item.kind === kind)
      const auto = pick('auto').sort((a, b) => b.model - a.model)
      const workflow = pick('workflow').sort((a, b) => b.manual - a.manual)
      const idle = pick('idle')
      const failed = pick('failed')
      return {
        items,
        auto,
        workflow,
        idle,
        failed,
        counts: {
          auto: auto.length,
          workflow: workflow.length,
          idle: idle.length,
          failed: failed.length,
        },
      }
    }

    // The same counts, but rolled up by what the user was trying to do.
    // Sorted by activity; a group with no calls still appears (it is a signal).
    function classifySituations(skills, usage) {
      const byName = (usage && usage.byName) || {}
      const manualByName = (usage && usage.manualByName) || {}
      const groups = new Map()
      for (const skill of skills || []) {
        const id = skill.situation || 'other'
        let group = groups.get(id)
        if (group === undefined) {
          group = { id, skills: 0, model: 0, manual: 0, used: 0 }
          groups.set(id, group)
        }
        const model = byName[skill.name] ?? 0
        const manual = manualByName[skill.name] ?? 0
        group.skills += 1
        group.model += model
        group.manual += manual
        if (model + manual > 0) group.used += 1
      }
      return [...groups.values()].sort(
        (a, b) => (b.model + b.manual) - (a.model + a.manual) || b.skills - a.skills,
      )
    }
    // ------------------------------------------------------------------ card

    // One skill card, extracted from Dashboard. It owns no state: every value
    // and callback it needs arrives through the card view.
    function renderSkillCard(view, skill) {
      const {
        T,
        isZh,
        zh,
        language,
        batchMode,
        picked,
        feedback,
        classifying,
        classifyBusy,
        classifyError,
        situations,
        vagueSet,
        newNames,
        togglePick,
        insert,
        copy,
        retranslate,
        copyOrigin,
        classify,
        setClassifying,
      } = view

        const manual = skill.modelInvocable === false
        const origin = originFor(skill)
        const busy = feedback.name === skill.name
        const originBusy = feedback.name === skill.name + '#origin'
        const translated = isZh ? zh[skill.name] || skill.zh || '' : ''
        const description = translated || skill.description
        return h('div', { className: 'sd-card' + (manual ? ' is-manual' : '') + (picked.includes(skill.name) ? ' is-picked' : ''), key: skill.name },
          batchMode
            ? h('label', { className: 'sd-pick' },
                h('input', {
                  type: 'checkbox',
                  checked: picked.includes(skill.name),
                  onChange: () => togglePick(skill.name),
                }),
                h('span', null, T.pickOne),
              )
            : null,
          h('div', { className: 'sd-card-top' },
            h('code', { className: 'sd-name' }, skill.name),
            h('div', { className: 'sd-badges' },
              manual ? h('span', { className: 'sd-badge is-manual' }, T.badgeManual) : h('span', { className: 'sd-badge' }, T.badgeAuto),
              newNames.has(skill.name) ? h('span', { className: 'sd-badge is-new' }, T.badgeNew) : null,
              skill.situationSource === 'heuristic' ? h('span', { className: 'sd-badge' }, T.auto) : null,
              vagueSet.has(skill.name) ? h('span', { className: 'sd-badge is-vague' }, T.badgeVague) : null,
            ),
          ),
          description ? h('p', { className: 'sd-desc', title: translated ? skill.description : undefined }, description) : null,
          manual
            ? h('div', { className: 'sd-trigger' },
                h('div', { className: 'sd-trigger-label' }, T.howto),
                h('div', { className: 'sd-trigger-text' }, triggerFor(skill, language)),
                h('div', { className: 'sd-actions' },
                  h('button', {
                    type: 'button',
                    className: 'sd-btn-mini is-primary' + (busy && feedback.kind === 'inserted' ? ' is-done' : ''),
                    onClick: () => insert(skill),
                  }, busy && feedback.kind === 'inserted' ? T.inserted : T.insert),
                  h('button', {
                    type: 'button',
                    className: 'sd-btn-mini' + (busy && (feedback.kind === 'copied' || feedback.kind === 'copied-fallback') ? ' is-done' : ''),
                    onClick: () => copy(skill),
                  }, busy && (feedback.kind === 'copied' || feedback.kind === 'copied-fallback') ? T.copied : T.copy),
                ),
                busy && feedback.kind === 'copied-fallback'
                  ? h('div', { className: 'sd-trigger-note' }, T.insertFailed)
                  : null,
              )
            : null,
          h('div', { className: 'sd-origin' },
            h('span', { className: 'sd-origin-label' }, T.origin),
            h('span', { className: 'sd-origin-value', title: origin || T.registryOrigin }, origin || T.registryOrigin),
            origin
              ? h('button', { type: 'button', className: 'sd-origin-copy', title: T.copyOrigin, onClick: () => copyOrigin(skill) },
                  originBusy ? T.copied : '⧉')
              : null,
          ),
          h('div', { className: 'sd-card-foot' },
            h('button', {
              type: 'button',
              className: 'sd-classify-toggle',
              onClick: () => setClassifying((current) => (current === skill.name ? '' : skill.name)),
            }, classifying === skill.name ? T.closeClassify : T.classify),
            isZh && zh[skill.name]
              ? h('button', {
                  type: 'button',
                  className: 'sd-classify-toggle',
                  onClick: () => retranslate(skill),
                }, T.retranslate)
              : null,
          ),
          classifying === skill.name
            ? h('div', { className: 'sd-classify' },
                situations.map((situation) =>
                  h('button', {
                    key: situation.id,
                    type: 'button',
                    className: 'sd-chip' + (skill.situation === situation.id ? ' is-current' : ''),
                    disabled: classifyBusy,
                    onClick: () => classify(skill, situation.id),
                  }, situation.title),
                ),
                classifyError ? h('div', { className: 'sd-classify-error' }, T.classifyFailed + classifyError) : null,
              )
            : null,
        )
    }
    // --------------------------------------------------------------- diagnose

    // The whole diagnostics page, extracted from Dashboard so the component
    // body is about state and events instead of 240 lines of markup. The view
    // argument carries the values and callbacks it renders; it owns no state.
    function renderDiagnoseView(view) {
      const {
        T,
        isZh,
        diag,
        onSituation,
        pluginHealth,
        situations,
        reportCopied,
        importOpen,
        importText,
        importError,
        preview,
        previewError,
        previewBusy,
        undoBusy,
        undoNotice,
        overrideNotice,
        backupNote,
        usageScope,
        usageLoading,
        activeUsage,
        topSkills,
        topMax,
        topManual,
        manualMax,
        modelCalls,
        manualTotal,
        failedCalls,
        partialScan,
        usageUnavailable,
        calledSkills,
        unusedSkills,
        unusedGroups,
        usageProfile,
        situationUsage,
        showUnused,
        vagueSkills,
        excludeError,
        ago,
        runDiagnose,
        copyReport,
        toggleScope,
        toggleExclude,
        exportOverride,
        setImportOpen,
        setImportText,
        setImportError,
        importOverride,
        previewOverride,
        resetPlan,
        clearPlan,
        undoOverride,
        setShowUnused,
        setMode,
        setView,
        copyText,
        setOverrideNotice,
      } = view

        const health = pluginHealth
        const planCounts = (preview && preview.counts) || {}
        const situationTitle = (id) => {
          const found = (situations || []).find((situation) => situation.id === id)
          return found ? found.title : id
        }
        return h('div', { className: 'sd-page' },
          h('div', { className: 'sd-status-row' },
            h('button', {
              type: 'button',
              className: 'sd-btn-sm',
              disabled: diag.status === 'loading',
              onClick: runDiagnose,
            }, diag.status === 'loading' ? T.diagnosing : diag.data ? T.rediagnose : T.diagnose),
            diag.data
              ? h('button', { type: 'button', className: 'sd-btn-sm', onClick: copyReport }, reportCopied ? T.copied : T.copyReport)
              : null,
            diag.status === 'error' ? h('span', { className: 'sd-status-err' }, diag.error) : null,
          ),

          health
            ? h('div', { className: 'sd-health' },
                h('span', { className: 'sd-pill' },
                  T.plugins, ' ', h('b', null, String(health.total)), ' · ',
                  h('b', null, String(health.active)), ' ', T.pluginActive,
                  health.failed > 0
                    ? h('span', { className: 'sd-pill-bad' }, ' · ', String(health.failed), ' ', T.pluginFailed)
                    : null,
                  health.disabled > 0
                    ? h('span', { className: 'sd-pill-muted' }, ' · ', String(health.disabled), ' ', T.pluginDisabled)
                    : null,
                ),
              )
            : null,

          health && Array.isArray(health.disabledNames) && health.disabledNames.length > 0
            ? h('div', { className: 'sd-diag-meta' },
                T.disabledList + '：' + health.disabledNames.map((row) => row.name).join('、'),
              )
            : null,

          health && health.failed > 0
            ? h('div', { className: 'sd-diag' },
                h('div', { className: 'sd-diag-head is-static' },
                  h('span', { className: 'sd-diag-warn' }, '⚠ ', T.failedList, ' ', String(health.failed)),
                ),
                h('div', { className: 'sd-diag-body' },
                  health.failedNames.map((plugin) =>
                    h('div', { className: 'sd-diag-item', key: plugin.moduleName || plugin.name },
                      h('div', { className: 'sd-diag-name' },
                        plugin.name,
                        plugin.phase ? h('span', { className: 'sd-diag-phase' }, plugin.phase) : null,
                      ),
                      plugin.moduleName ? h('div', { className: 'sd-diag-module' }, plugin.moduleName) : null,
                      h('div', { className: 'sd-diag-text' }, plugin.diagnostic || T.diagEmpty),
                    ),
                  ),
                ),
              )
            : null,

          diag.data && diag.data.capabilities
            ? h('div', { className: 'sd-diag-meta' },
                T.capabilitiesLabel + '：' + (diag.data.capabilities.missing.length === 0
                  ? T.capabilitiesAll
                  : diag.data.capabilities.missing.map((cap) => (isZh ? cap.label : cap.labelEn)).join('、')),
              )
            : null,

          diag.data && diag.data.taxonomy
            ? h('div', { className: 'sd-diag-meta' },
                T.taxonomyLabel + '：v' + String(diag.data.taxonomy.version) + ' · ' + String(diag.data.taxonomy.situations) + ' · ' + String(diag.data.taxonomy.skills),
              )
            : null,

          h('div', { className: 'sd-status-row' },
            h('button', { type: 'button', className: 'sd-btn-sm', onClick: exportOverride }, T.exportOverride),
            h('button', {
              type: 'button',
              className: 'sd-btn-sm',
              onClick: () => {
                setImportOpen((value) => !value)
                setImportError('')
              },
            }, importOpen ? T.importCancel : T.importOverride),
            h('button', {
              type: 'button',
              className: 'sd-btn-sm',
              onClick: resetPlan,
            }, T.resetPlan),
            h('button', {
              type: 'button',
              className: 'sd-btn-sm',
              disabled: undoBusy,
              onClick: undoOverride,
            }, T.undoPlan),
            overrideNotice ? h('span', { className: 'sd-status-note' }, overrideNotice) : null,
            undoNotice ? h('span', { className: 'sd-status-note' }, undoNotice) : null,
          ),
          backupNote ? h('div', { className: 'sd-notice' }, backupNote) : null,

          importOpen
            ? h('div', { className: 'sd-import' },
                h('textarea', {
                  className: 'sd-import-text',
                  rows: 6,
                  placeholder: '{ "skills": { "my-skill": { "situation": "code" } }, "exclude": ["noisy"] }',
                  value: importText,
                  onChange: (event) => {
                    setImportText(event.target.value)
                    clearPlan()
                  },
                }),
                h('div', { className: 'sd-status-row' },
                  h('button', {
                    type: 'button',
                    className: 'sd-btn-sm',
                    disabled: previewBusy,
                    onClick: () => previewOverride(),
                  }, previewBusy ? T.scanning : T.previewPlan),
                  importError ? h('span', { className: 'sd-status-err' }, importError) : null,
                  previewError ? h('span', { className: 'sd-status-err' }, previewError) : null,
                ),
                preview
                  ? h('div', { className: 'sd-status-note' },
                      h('div', null,
                        planCounts.situations === 0 && planCounts.excludeAdded === 0 && planCounts.excludeRemoved === 0
                          ? T.previewEmpty
                          : T.previewChanges(planCounts.situations || 0)),
                      (preview.changes || []).length > 0
                        ? h('div', null, preview.changes.slice(0, 12).map((change) =>
                            `${change.name}: ${situationTitle(change.from)} → ${situationTitle(change.to)}`).join('；'))
                        : null,
                      (preview.excludeAdded || []).length > 0
                        ? h('div', null, T.previewExcludeAdded(preview.excludeAdded.length) + preview.excludeAdded.join('、'))
                        : null,
                      (preview.excludeRemoved || []).length > 0
                        ? h('div', null, T.previewExcludeRemoved(preview.excludeRemoved.length) + preview.excludeRemoved.join('、'))
                        : null,
                      h('div', { className: 'sd-status-row' },
                        h('button', {
                          type: 'button',
                          className: 'sd-btn-sm is-primary',
                          disabled: previewBusy,
                          onClick: importOverride,
                        }, T.applyPlan),
                        h('button', {
                          type: 'button',
                          className: 'sd-btn-sm',
                          onClick: clearPlan,
                        }, T.importCancel),
                      ),
                    )
                  : null,
              )
            : null,

          h("div", { className: "sd-section-title" }, T.auditTitle),
          vagueSkills.length === 0
            ? h("div", { className: "sd-diag-meta" }, T.auditGood)
            : h("div", { className: "sd-diag-meta" }, T.auditBody(vagueSkills.length)),
          vagueSkills.length > 0
            ? h("div", { className: "sd-unused-names" }, vagueSkills.map((skill) => skill.name).join("、"))
            : null,
          h("div", { className: "sd-status-row" },
            h("button", {
              type: "button",
              className: "sd-btn-sm",
              onClick: async () => {
                await copyText(RULE_SNIPPET)
                setOverrideNotice(T.ruleCopied)
              },
            }, overrideNotice === T.ruleCopied ? T.ruleCopied : T.copyRule),
            h("button", {
              type: "button",
              className: "sd-btn-sm",
              onClick: () => {
                setMode("vague")
                setView("skills")
              },
            }, T.vague),
          ),

          h("div", { className: "sd-section-title" }, T.profileTitle),
          h('div', { className: 'sd-status-row' },
            h('span', { className: 'sd-pill' }, T.profileAuto + ' ' + usageProfile.counts.auto),
            h('span', { className: 'sd-pill' }, T.profileWorkflow + ' ' + usageProfile.counts.workflow),
            h('span', { className: 'sd-pill' }, T.profileIdle + ' ' + usageProfile.counts.idle),
            usageProfile.counts.failed > 0
              ? h('span', { className: 'sd-pill-bad' }, T.profileFailed + ' ' + usageProfile.counts.failed)
              : null,
          ),
          h('div', { className: 'sd-status-note' }, T.profileHint),
          usageProfile.workflow.length > 0
            ? h('div', { className: 'sd-status-note' }, T.profileWorkflow + '：' + usageProfile.workflow.slice(0, 8).map((item) => `${item.name}×${item.manual}`).join(' · '))
            : null,
          usageProfile.auto.length > 0
            ? h('div', { className: 'sd-status-note' }, T.profileAuto + '：' + usageProfile.auto.slice(0, 8).map((item) => `${item.name}×${item.model}`).join(' · '))
            : null,
          usageProfile.failed.length > 0
            ? h('div', { className: 'sd-status-note' }, T.profileFailed + '：' + usageProfile.failed.map((item) => item.name).join('、'))
            : null,

          h("div", { className: "sd-section-title" }, T.situationUsageTitle),
          h('div', { className: 'sd-status-note' }, T.situationUsageHint),
          situationUsage.length > 0
            ? h('div', { className: 'sd-sit-usage' }, situationUsage.map((group) =>
                h('div', {
                  className: 'sd-sit-row is-clickable',
                  key: group.id,
                  onClick: () => onSituation(group.id),
                },
                  h('span', { className: 'sd-sit-name' }, situationTitle(group.id)),
                  h('span', { className: 'sd-sit-count' },
                    `${group.model} 模型 · ${group.manual} 手动 · ${group.used}/${group.skills}`),
                )))
            : null,

          h("div", { className: "sd-section-title" }, T.usageTitle),
          h('div', { className: 'sd-status-row' },
            h('span', { className: 'sd-pill' }, usageScope === 'all' ? T.allSessions : T.sessionLabel, ' ', modelCalls + ' 模型 · ' + manualTotal + ' 手动'),
            h('button', {
              type: 'button',
              className: 'sd-btn-sm',
              disabled: usageLoading,
              onClick: toggleScope,
            }, usageLoading ? T.scanning : usageScope === 'all' ? T.scopeSession : T.scopeAll),
          ),
          usageUnavailable
            ? h('div', { className: 'sd-status-err' }, T.usageUnavailable + (activeUsage.error ? '：' + activeUsage.error : ''))
            : null,
          partialScan
            ? h('div', { className: 'sd-status-note' }, T.partialScan(activeUsage.scanned, activeUsage.sessionCount))
            : null,
          failedCalls > 0 ? h('div', { className: 'sd-status-note' }, T.usageFailed(failedCalls)) : null,

          h('div', { className: 'sd-usage-head' },
            T.usageModel,
            h('span', { className: 'sd-usage-total' }, String(modelCalls) + T.times),
          ),
          topSkills.length > 0
            ? h('div', { className: 'sd-bars' },
                topSkills.map(([name, count]) =>
                  h('div', { className: 'sd-bar-row', key: name },
                    h('span', { className: 'sd-bar-name', title: name }, name),
                    h('span', { className: 'sd-bar-track' },
                      h('span', { className: 'sd-bar-fill', style: { width: Math.max(6, Math.round((count / topMax) * 100)) + '%' } }),
                    ),
                    h('span', { className: 'sd-bar-count' }, String(count)),
                  ),
                ),
              )
            : h('div', { className: 'sd-status-note' }, T.usageNone),

          h('div', { className: 'sd-usage-head' },
            T.usageManual,
            h('span', { className: 'sd-usage-total' }, String(manualTotal) + T.times),
          ),
          topManual.length > 0
            ? h('div', { className: 'sd-bars' },
                topManual.map(([name, count]) =>
                  h('div', { className: 'sd-bar-row', key: name },
                    h('span', { className: 'sd-bar-name', title: name }, name),
                    h('span', { className: 'sd-bar-track' },
                      h('span', { className: 'sd-bar-fill is-manual', style: { width: Math.max(6, Math.round((count / manualMax) * 100)) + '%' } }),
                    ),
                    h('span', { className: 'sd-bar-count' }, String(count)),
                  ),
                ),
              )
            : h('div', { className: 'sd-status-note' }, T.usageNone),

          calledSkills.length > 0
            ? h('div', { className: 'sd-table' },
                calledSkills.map((entry) =>
                  h('div', { className: 'sd-trow', key: entry.name },
                    h('span', { className: 'sd-tname', title: entry.name }, entry.name),
                    h('span', { className: 'sd-tcount', title: T.colModel }, entry.model > 0 ? String(entry.model) : '·'),
                    h('span', { className: 'sd-tnamed', title: T.colManual }, entry.manual > 0 ? String(entry.manual) : '·'),
                    h('span', { className: 'sd-tlast' }, ago(entry.last)),
                    h('button', {
                      type: 'button',
                      className: 'sd-tx',
                      title: T.excludeSkill,
                      onClick: () => toggleExclude(entry.name, true),
                    }, '⊘'),
                  ),
                ),
              )
            : h('div', { className: 'sd-status-note' }, T.sessionEmpty),

          h('button', {
            type: 'button',
            className: 'sd-btn-sm',
            onClick: () => setShowUnused((value) => !value),
          }, (showUnused ? T.hideUnused : T.showUnused) + ' · ' + String(unusedSkills.length)),

          excludeError ? h('div', { className: 'sd-classify-error' }, T.excludedFailed + excludeError) : null,
          (activeUsage && Array.isArray(activeUsage.excluded) ? activeUsage.excluded : []).length > 0
            ? h('div', { className: 'sd-status-note' },
                T.excludedLine(activeUsage.excluded.length),
                activeUsage.excluded.map((name) =>
                  h('button', {
                    key: name,
                    type: 'button',
                    className: 'sd-chip',
                    onClick: () => toggleExclude(name, false),
                  }, name),
                ),
              )
            : null,

          showUnused
            ? h('div', { className: 'sd-unused' },
                unusedGroups.map((group) =>
                  h('div', { className: 'sd-unused-group', key: group.id },
                    h('div', { className: 'sd-unused-title' },
                      group.title,
                      h('span', { className: 'sd-group-count' }, String(group.names.length)),
                    ),
                    h('div', { className: 'sd-unused-names' }, group.names.join('、')),
                  ),
                ),
              )
            : null,
        )
    }
    // ----------------------------------------------------------------- style
    const CSS = `
.sd-root {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 0 12px 28px;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  background: var(--dsw-alias-bg-base);
}
.sd-root::-webkit-scrollbar { width: 8px; }
.sd-root::-webkit-scrollbar-thumb { background: var(--dsw-alias-border-l2); border-radius: 999px; }
.sd-root::-webkit-scrollbar-track { background: transparent; }
.sd-head { display: flex; flex-direction: column; gap: 4px; padding: 14px 0 10px; }
.sd-eyebrow { color: var(--dsw-alias-label-secondary); font-size: 9px; font-weight: 700; letter-spacing: .16em; opacity: .8; }
.sd-title { font-size: 16px; font-weight: 680; letter-spacing: -.015em; line-height: 1.2; }
.sd-sub { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.5; }
.sd-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
.sd-stat { border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px; background: var(--dsw-alias-bg-layer-1); padding: 6px 8px 5px; min-width: 0; }
.sd-stat-label { color: var(--dsw-alias-label-secondary); font-size: 9.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sd-stat-value { font-size: 17px; font-weight: 680; line-height: 1.15; font-variant-numeric: tabular-nums; }
.sd-stat.is-manual { border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 42%, var(--dsw-alias-border-l2)); }
.sd-stat.is-manual .sd-stat-value { color: var(--dsw-alias-state-warn-primary); }
.sd-switch { display: flex; gap: 4px; margin-top: 9px; }
.sd-switch-btn {
  border: 1px solid var(--dsw-alias-border-l2); background: transparent;
  color: var(--dsw-alias-label-secondary); border-radius: 7px;
  padding: 1px 10px; font: inherit; font-size: 11px; line-height: 1.8; cursor: pointer;
}
.sd-switch-btn.is-on {
  border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.sd-page { display: flex; flex-direction: column; gap: 8px; padding-bottom: 20px; }
.sd-section-title { color: var(--dsw-alias-label-secondary); font-size: 10px; letter-spacing: .09em; text-transform: uppercase; margin-top: 6px; }
.sd-diag-meta { color: var(--dsw-alias-label-secondary); font-size: 10.5px; line-height: 1.5; overflow-wrap: anywhere; }
.sd-diag-head.is-static { cursor: default; }
.sd-table { display: flex; flex-direction: column; gap: 2px; }
.sd-trow {
  display: grid; grid-template-columns: minmax(0, 1fr) 26px 26px 52px 16px;
  align-items: center; gap: 6px; padding: 2px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.sd-tname {
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sd-tcount { font-size: 10.5px; text-align: right; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
.sd-tlast { font-size: 9.5px; text-align: right; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.sd-tnamed { font-size: 10px; text-align: right; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }
.sd-tx {
  border: 0; background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 10px; line-height: 1; padding: 0; cursor: pointer; opacity: .45;
}
.sd-tx:hover { opacity: 1; color: var(--dsw-alias-state-error-primary); }
.sd-chip { border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-secondary); border-radius: 999px; padding: 0 7px; font: inherit; font-size: 10px; line-height: 1.7; cursor: pointer; margin: 0 3px 3px 0; }
.sd-unused { display: flex; flex-direction: column; gap: 7px; }
.sd-unused-title { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); font-size: 10px; }
.sd-unused-names { color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
.sd-status { display: flex; flex-direction: column; gap: 7px; margin-top: 9px; }
.sd-status-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sd-btn-sm {
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary); border-radius: 7px;
  padding: 2px 9px; font: inherit; font-size: 10.5px; line-height: 1.7; cursor: pointer;
}
.sd-btn-sm:hover:enabled { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); }
.sd-btn-sm:disabled { opacity: .55; cursor: default; }
.sd-status-err { color: var(--dsw-alias-state-error-primary); font-size: 10px; }
.sd-status-note { color: var(--dsw-alias-label-secondary); font-size: 10px; }
.sd-bars { display: flex; flex-direction: column; gap: 3px; }
.sd-bar-row { display: grid; grid-template-columns: minmax(64px, 38%) 1fr auto; align-items: center; gap: 6px; }
.sd-bar-name {
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-size: 10px; color: var(--dsw-alias-label-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sd-bar-track { height: 5px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.sd-bar-fill {
  display: block; height: 100%; border-radius: 999px;
  background: var(--dsw-alias-state-warn-primary); opacity: .85;
}
.sd-bar-fill.is-manual { opacity: 1; }
.sd-usage-head {
  display: flex; align-items: baseline; gap: 6px; margin-top: 4px;
  font-size: 10px; color: var(--dsw-alias-label-secondary);
}
.sd-usage-total { margin-left: auto; font-variant-numeric: tabular-nums; }
.sd-bar-count { font-size: 10px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.sd-health { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.sd-pill {
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px;
  padding: 1px 9px; color: var(--dsw-alias-label-secondary);
  font-size: 10.5px; line-height: 1.75; white-space: nowrap;
}
.sd-pill b { color: var(--dsw-alias-label-primary); font-weight: 650; font-variant-numeric: tabular-nums; }
.sd-pill-bad { color: var(--dsw-alias-state-error-primary); font-weight: 650; }
.sd-pill-muted { opacity: .75; }
.sd-health-warn {
  margin-top: 6px; color: var(--dsw-alias-state-error-primary);
  font-size: 10.5px; line-height: 1.5; overflow-wrap: anywhere;
}
.sd-diag {
  margin-top: 7px; overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, var(--dsw-alias-border-l2));
  border-radius: 8px;
}
.sd-diag-head {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  background: transparent; border: 0; padding: 5px 9px;
  font: inherit; font-size: 10.5px; cursor: pointer;
  color: var(--dsw-alias-state-error-primary);
}
.sd-diag-head:hover { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent); }
.sd-diag-toggle { color: var(--dsw-alias-label-secondary); font-size: 10px; }
.sd-diag-body {
  border-top: 1px solid var(--dsw-alias-border-l1);
  padding: 7px 9px; display: flex; flex-direction: column; gap: 8px;
}
.sd-diag-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sd-diag-name {
  color: var(--dsw-alias-label-primary); font-size: 11px; font-weight: 600;
  display: flex; gap: 6px; align-items: baseline; overflow-wrap: anywhere;
}
.sd-diag-phase {
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent);
  border-radius: 4px; padding: 0 4px; font-size: 9px; line-height: 1.6;
  color: var(--dsw-alias-state-error-primary); flex: none;
}
.sd-diag-module {
  color: var(--dsw-alias-label-secondary); font-size: 9.5px;
  font-family: var(--ds-font-family-code, ui-monospace, monospace); overflow-wrap: anywhere;
}
.sd-diag-text {
  color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 1.5;
  white-space: pre-wrap; overflow-wrap: anywhere;
  max-height: 120px; overflow: auto;
}
.sd-diag-more { color: var(--dsw-alias-label-secondary); font-size: 9.5px; }
.sd-badge.is-used {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
  color: var(--dsw-alias-brand-primary); font-weight: 600;
}
.sd-sticky {
  position: sticky; top: 0; z-index: 3;
  margin: 0 -12px; padding: 8px 12px 7px;
  background: var(--dsw-alias-bg-base);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  display: flex; flex-direction: column; gap: 7px;
}
.sd-search-row { display: flex; gap: 6px; align-items: center; }
.sd-search-wrap { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; }
.sd-search-icon { position: absolute; left: 8px; width: 13px; height: 13px; color: var(--dsw-alias-label-secondary); pointer-events: none; }
.sd-search {
  width: 100%; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  border-radius: 8px; padding: 6px 9px 6px 27px;
  font: inherit; font-size: 12px;
}
.sd-search::placeholder { color: var(--dsw-alias-label-secondary); }
.sd-search:focus { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
.sd-icon-btn {
  flex: none; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  cursor: pointer; padding: 0;
}
.sd-icon-btn:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); }
.sd-icon-btn svg { width: 13px; height: 13px; }
.sd-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.sd-chip {
  border: 1px solid var(--dsw-alias-border-l2); background: transparent;
  color: var(--dsw-alias-label-secondary); border-radius: 999px;
  padding: 1px 10px; font: inherit; font-size: 11px; line-height: 1.7; cursor: pointer;
  transition: color .15s ease, border-color .15s ease, background-color .15s ease;
}
.sd-chip:hover { color: var(--dsw-alias-label-primary); }
.sd-chip[aria-pressed="true"] {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.sd-chip[data-chip="manual"][aria-pressed="true"] {
  border-color: var(--dsw-alias-state-warn-primary);
  color: var(--dsw-alias-state-warn-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
}
.sd-chip-n { opacity: .6; font-variant-numeric: tabular-nums; font-size: 10px; margin-left: 3px; }
.sd-banner {
  margin-top: 10px; border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 34%, var(--dsw-alias-border-l2));
  border-radius: 10px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-state-warn-primary) 13%, transparent), transparent 70%);
  padding: 9px 11px; display: flex; flex-direction: column; gap: 3px;
}
.sd-banner-title { color: var(--dsw-alias-state-warn-primary); font-size: 11.5px; font-weight: 650; }
.sd-banner-body { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.55; }
.sd-group { margin-top: 14px; }
.sd-group-head { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.sd-group-title { color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 650; letter-spacing: .09em; text-transform: uppercase; white-space: nowrap; }
.sd-group-count {
  color: var(--dsw-alias-label-secondary); font-size: 9.5px; font-variant-numeric: tabular-nums;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; padding: 0 5px; line-height: 1.6;
}
.sd-group-rule { flex: 1; height: 1px; background: var(--dsw-alias-border-l1); }
.sd-group-note { color: var(--dsw-alias-label-secondary); font-size: 10.5px; line-height: 1.5; margin: -2px 0 7px; }
.sd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 8px; align-items: start; }
.sd-card {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  padding: 9px 10px 8px;
  display: flex; flex-direction: column; gap: 5px;
  min-width: 0;
  transition: border-color .16s ease;
}
.sd-card:hover { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, var(--dsw-alias-border-l2)); }
.sd-card.is-manual { border-left: 3px solid var(--dsw-alias-state-warn-primary); padding-left: 8px; }
.sd-card-top { display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap; }
.sd-name {
  flex: 1; min-width: 0;
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11.5px; font-weight: 600; line-height: 1.45;
  overflow-wrap: anywhere;
}
.sd-badges { display: flex; gap: 4px; flex: none; }
.sd-badge {
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 5px;
  color: var(--dsw-alias-label-secondary); font-size: 9.5px; line-height: 1.7;
  padding: 0 5px; white-space: nowrap;
}
.sd-badge.is-manual {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, transparent);
  color: var(--dsw-alias-state-warn-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
  font-weight: 600;
}
.sd-badge.is-vague {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent);
  color: var(--dsw-alias-state-warn-primary);
  opacity: .85;
}
.sd-chip[data-chip="vague"][aria-pressed="true"] {
  border-color: var(--dsw-alias-state-warn-primary);
  color: var(--dsw-alias-state-warn-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
}
.sd-desc {
  margin: 0; color: var(--dsw-alias-label-secondary);
  font-size: 11px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  overflow-wrap: anywhere;
}
.sd-trigger {
  display: flex; flex-direction: column; gap: 5px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 24%, var(--dsw-alias-border-l1));
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 7%, transparent);
  border-radius: 8px; padding: 6px 8px 6px;
}
.sd-trigger-label { color: var(--dsw-alias-state-warn-primary); font-size: 9px; font-weight: 650; letter-spacing: .08em; opacity: .9; }
.sd-trigger-text { font-size: 11px; line-height: 1.55; overflow-wrap: anywhere; }
.sd-actions { display: flex; gap: 5px; justify-content: flex-end; }
.sd-btn-mini {
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent);
  background: transparent; color: var(--dsw-alias-state-warn-primary);
  border-radius: 6px; padding: 0 8px; font: inherit; font-size: 10px; line-height: 1.9; cursor: pointer;
}
.sd-btn-mini:hover { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent); }
.sd-btn-mini.is-primary { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent); font-weight: 600; }
.sd-btn-mini.is-done { border-color: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); }
.sd-trigger-note { color: var(--dsw-alias-label-secondary); font-size: 9.5px; line-height: 1.5; }
.sd-notice {
  margin-top: 10px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, var(--dsw-alias-border-l2));
  border-radius: 8px; padding: 6px 9px;
  color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.5;
}
.sd-batch { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.sd-btn-sm.is-on { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.sd-pick { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.sd-pick input { accent-color: var(--dsw-alias-brand-primary); }
.sd-card.is-picked { border-color: var(--dsw-alias-brand-primary); }
.sd-import { display: flex; flex-direction: column; gap: 6px; }
.sd-import-text {
  width: 100%; box-sizing: border-box; font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-size: 10px; line-height: 1.5; padding: 6px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); resize: vertical;
}
.sd-card-foot { display: flex; justify-content: flex-end; margin-top: 1px; }
.sd-classify-toggle {
  border: 0; background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 9.5px; cursor: pointer; padding: 0 2px; line-height: 1.7;
}
.sd-classify-toggle:hover { color: var(--dsw-alias-brand-primary); }
.sd-classify { display: flex; flex-wrap: wrap; gap: 4px; padding-top: 3px; }
.sd-classify .sd-chip { font-size: 10px; padding: 0 7px; line-height: 1.7; }
.sd-classify .sd-chip.is-current {
  border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.sd-classify-error { color: var(--dsw-alias-state-error-primary); font-size: 9.5px; }
.sd-origin {
  display: flex; align-items: center; gap: 6px;
  border-top: 1px dashed var(--dsw-alias-border-l1);
  padding-top: 4px; margin-top: 1px;
}
.sd-origin-label { color: var(--dsw-alias-label-secondary); font-size: 9.5px; flex: none; }
.sd-origin-value {
  flex: 1; min-width: 0; color: var(--dsw-alias-label-secondary);
  font-size: 9.5px; line-height: 1.6;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
}
.sd-origin-copy {
  flex: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 9.5px; cursor: pointer; padding: 0 2px; line-height: 1.6;
}
.sd-origin-copy:hover { color: var(--dsw-alias-label-primary); }
.sd-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 8px; text-align: center; }
.sd-empty-title { color: var(--dsw-alias-label-primary); font-size: 12px; font-weight: 550; }
.sd-empty-hint { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.5; }
.sd-err { color: var(--dsw-alias-state-error-primary); }
.sd-skeleton { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; height: 58px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; position: relative; }
.sd-skeleton::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent 20%, color-mix(in srgb, var(--dsw-alias-label-secondary) 9%, transparent) 50%, transparent 80%);
  transform: translateX(-100%);
  animation: sd-shimmer 1.5s infinite;
}
@keyframes sd-shimmer { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .sd-skeleton::after { animation: none; } }
.sd-hbtn {
  border: 1px solid var(--dsw-alias-border-l2); background: transparent;
  color: var(--dsw-alias-label-secondary); border-radius: 6px;
  padding: 1px 7px; font: inherit; font-size: 11px; line-height: 1.6; cursor: pointer;
}
.sd-hbtn:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.sd-sit-usage { margin: 4px 0 8px; }
.sd-sit-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 3px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.sd-sit-row:last-child { border-bottom: none; }
.sd-sit-name { font-weight: 600; }
.sd-sit-count { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.sd-sit-row.is-clickable { cursor: pointer; }
.sd-badge.is-new { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.sd-translate-banner {
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1); padding: 10px 12px; margin: 8px 0 10px;
}
.sd-check { display: flex; align-items: center; gap: 6px; margin: 6px 0; color: var(--dsw-alias-label-secondary); font-size: 11px; cursor: pointer; }
.sd-starter {
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1); padding: 10px 12px; margin: 8px 0 10px;
}
.sd-starter-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.sd-starter-body { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.55; }
.sd-starter-list { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
.sd-starter-item { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sd-starter-desc { flex: 1; min-width: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sd-starter-actions { display: flex; gap: 4px; flex: none; }
`

    // --------------------------------------------------------------- starter

    // A beginner does not need another wall of cards. Pick at most three
    // skills that the model can actually choose, that say when to use them,
    // and that have not been used yet in the current scope. Distinct
    // situations first, so the guide does not hand them three coding skills.
    function pickStarterSkills(skills, profile) {
      const used = new Set([
        ...((profile && profile.auto) || []).map((item) => item.name),
        ...((profile && profile.workflow) || []).map((item) => item.name),
      ])
      const candidates = (skills || []).filter(
        (skill) =>
          skill.modelInvocable !== false &&
          typeof skill.description === 'string' &&
          skill.description !== '' &&
          !used.has(skill.name) &&
          !isVagueSkill(skill),
      )
      const picked = []
      const situations = new Set()
      for (const skill of candidates) {
        if (situations.has(skill.situation)) continue
        picked.push(skill)
        situations.add(skill.situation)
        if (picked.length === 3) return picked
      }
      for (const skill of candidates) {
        if (picked.includes(skill)) continue
        picked.push(skill)
        if (picked.length === 3) break
      }
      return picked
    }

    function renderStarterGuide(view) {
      const { T, isZh, zh, language, skills, usageProfile, insert, copy, setTranslateOpen, setView } = view
      const picks = pickStarterSkills(skills, usageProfile)
      if (picks.length === 0) return null
      return h('div', { className: 'sd-starter' },
        h('div', { className: 'sd-starter-title' }, T.starterTitle),
        h('div', { className: 'sd-starter-body' }, T.starterBody),
        h('div', { className: 'sd-starter-list' },
          picks.map((skill) =>
            h('div', { className: 'sd-starter-item', key: skill.name },
              h('code', { className: 'sd-name' }, skill.name),
              h('span', { className: 'sd-starter-desc' },
                (isZh ? zh[skill.name] || skill.zh : '') || firstSentence(skill.description)),
              h('div', { className: 'sd-starter-actions' },
                h('button', { type: 'button', className: 'sd-btn-mini is-primary', onClick: () => insert(skill) }, T.insert),
                h('button', { type: 'button', className: 'sd-btn-mini', onClick: () => copy(skill) }, T.copy),
              ),
            ))),
        h('div', { className: 'sd-status-row' },
          h('button', { type: 'button', className: 'sd-btn-sm', onClick: () => setTranslateOpen(true) }, T.translate),
          h('button', { type: 'button', className: 'sd-btn-sm', onClick: () => setView('diagnose') }, T.starterRule),
        ),
      )
    }
    // ------------------------------------------------------------ data hooks

    // The catalog payload and the optional Chinese descriptions are one
    // resource: both poll the same session and one of them merges into the
    // other. Keeping them in a hook moves the abort/stale/timeout dance out of
    // Dashboard and gives the component a single place to call `reload`.
    function useSkillCatalog(sessionId, language) {
      const [data, setData] = React.useState({
        status: 'loading',
        skills: [],
        situations: FALLBACK_SITUATIONS,
        counts: null,
        error: '',
        stale: false,
        overrideNote: '',
        capabilities: null,
        problem: null,
        plugins: null,
        usage: null,
        model: null,
        translate: null,
        skillsChanges: null,
      })
      const [zh, setZh] = React.useState({})
      const [tick, setTick] = React.useState(0)

      React.useEffect(() => {
        let alive = true
        const controller = typeof AbortController === 'function' ? new AbortController() : null
        const url = sessionId ? ZH_ROUTE + '?session=' + encodeURIComponent(sessionId) : ZH_ROUTE
        fetch(url, controller ? { signal: controller.signal } : undefined)
          .then((response) => response.json())
          .then((payload) => {
            if (alive && payload && payload.ok === true && payload.zh) setZh(payload.zh)
          })
          .catch(() => {
            /* no translation: the cards keep the original description */
          })
        return () => {
          alive = false
          if (controller) controller.abort()
        }
      }, [sessionId])

      React.useEffect(() => {
        let alive = true
        const controller = typeof AbortController === 'function' ? new AbortController() : null

        const load = () => {
          const params = new URLSearchParams()
          if (sessionId) params.set('session', sessionId)
          if (language) params.set('lang', language)
          const url = params.toString() ? ROUTE + '?' + params.toString() : ROUTE
          fetch(url, controller ? { signal: controller.signal } : undefined)
            .then((response) => response.json())
            .then((payload) => {
              if (!alive) return
              if (!payload || payload.ok !== true) {
                setData((prev) => ({
                  ...prev,
                  status: prev.status === 'ready' ? 'ready' : 'error',
                  error: String((payload && payload.error) || 'bad payload'),
                  stale: prev.status === 'ready',
                }))
                return
              }
              setData({
                status: 'ready',
                skills: payload.skills || [],
                situations: payload.situations && payload.situations.length > 0 ? payload.situations : FALLBACK_SITUATIONS,
                counts: payload.counts || null,
                error: '',
                stale: false,
                overrideNote: String(payload.overrideNote || ''),
                capabilities: payload.capabilities || null,
                problem: payload.problem || null,
                plugins: payload.plugins || null,
                usage: payload.usage || null,
                model: payload.model || null,
                translate: payload.translate || null,
                skillsChanges: payload.skillsChanges || null,
              })
              if (payload.zh) setZh((previous) => ({ ...previous, ...payload.zh }))
            })
            .catch((error) => {
              if (!alive || (error && error.name === 'AbortError')) return
              setData((prev) => ({
                ...prev,
                status: prev.status === 'ready' ? 'ready' : 'error',
                error: String((error && error.message) || error),
                stale: prev.status === 'ready',
              }))
            })
        }

        load()
        const timer = setInterval(load, 30000)
        return () => {
          alive = false
          clearInterval(timer)
          if (controller) controller.abort()
        }
      }, [tick, sessionId, language])

      return { data, setData, zh, setZh, tick, setTick }
    }
    // ---------------------------------------------------------------- icons
    function IconSearch() {
      return h('svg', { viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', className: 'sd-search-icon' },
        h('circle', { cx: 11, cy: 11, r: 7 }),
        h('line', { x1: 16.5, y1: 16.5, x2: 21, y2: 21 }),
      )
    }

    function IconRefresh() {
      return h('svg', { viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M20 11a8 8 0 1 0-2.3 6.3' }),
        h('path', { d: 'M20 5v6h-6' }),
      )
    }

    function GuideIcon(props) {
      const size = (props && props.size) || 16
      return h('svg', { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true },
        h('rect', { x: 4, y: 4, width: 56, height: 56, rx: 14, fill: 'currentColor', opacity: 0.12 }),
        h('rect', { x: 12, y: 14, width: 16, height: 11, rx: 3, fill: 'currentColor', opacity: 0.55 }),
        h('rect', { x: 33, y: 14, width: 19, height: 11, rx: 3, fill: 'currentColor' }),
        h('rect', { x: 12, y: 30, width: 19, height: 11, rx: 3, fill: 'currentColor', opacity: 0.55 }),
        h('rect', { x: 35, y: 30, width: 17, height: 11, rx: 3, fill: 'currentColor', opacity: 0.3 }),
        h('circle', { cx: 46, cy: 47, r: 7, fill: 'none', stroke: 'currentColor', strokeWidth: 3.4 }),
      )
    }

    // -------------------------------------------------------------- dashboard
    function Dashboard(props) {
      const sessionId = props && props.sessionId ? String(props.sessionId) : ''
      const [language, setLanguage] = React.useState(activeLanguage())
      const { data, setData, zh, setZh, tick, setTick } = useSkillCatalog(sessionId, language)
      const T = stringsFor(language)
      const isZh = /^zh/i.test(language || '')
      const [query, setQuery] = React.useState('')
      const [mode, setMode] = React.useState('all')
      const [situationFilter, setSituationFilter] = React.useState('')
      const [starterOpen, setStarterOpen] = React.useState(false)
      const [feedback, setFeedback] = React.useState({ name: '', kind: '' })
      const [diagOpen, setDiagOpen] = React.useState(false)
      const [diag, setDiag] = React.useState({ status: 'idle', data: null, error: '' })
      const [usageScope, setUsageScope] = React.useState('session')
      const [usageAll, setUsageAll] = React.useState(null)
      const [usageLoading, setUsageLoading] = React.useState(false)
      const [reportCopied, setReportCopied] = React.useState(false)
      const [view, setView] = React.useState('skills')
      const [showUnused, setShowUnused] = React.useState(false)
      const [classifying, setClassifying] = React.useState('')
      const [classifyBusy, setClassifyBusy] = React.useState(false)
      const [classifyError, setClassifyError] = React.useState('')
      const [excludeError, setExcludeError] = React.useState('')
      const [batchMode, setBatchMode] = React.useState(false)
      const [picked, setPicked] = React.useState([])
      const [importOpen, setImportOpen] = React.useState(false)
      const [importText, setImportText] = React.useState('')
      const [importError, setImportError] = React.useState('')
      const [overrideNotice, setOverrideNotice] = React.useState('')
      const [backupNote, setBackupNote] = React.useState('')
      const [translateOpen, setTranslateOpen] = React.useState(false)
      const [translating, setTranslating] = React.useState(false)
      const [translateConsent, setTranslateConsent] = React.useState(rememberedTranslateConsent())
      const [rememberConsent, setRememberConsent] = React.useState(true)
      const [translateNotice, setTranslateNotice] = React.useState('')
      const [translateError, setTranslateError] = React.useState('')
      const [preview, setPreview] = React.useState(null)
      const [pendingPlan, setPendingPlan] = React.useState(null)
      const [previewError, setPreviewError] = React.useState('')
      const [previewBusy, setPreviewBusy] = React.useState(false)
      const [undoBusy, setUndoBusy] = React.useState(false)
      const [undoNotice, setUndoNotice] = React.useState('')

      // Follow the host locale: switching the app language must repaint this
      // tab, including the situation titles the Host already localized.
      React.useEffect(() => {
        const locale = hostCtx?.get?.('locale')
        if (!locale || typeof locale.subscribe !== 'function') return undefined
        const off = locale.subscribe(() => setLanguage(activeLanguage()))
        return () => {
          try {
            if (typeof off === 'function') off()
          } catch (error) {
            /* already disposed */
          }
        }
      }, [])

      const skills = data.skills || []
      const counts = data.counts || {
        total: skills.length,
        manual: skills.filter((skill) => skill.modelInvocable === false).length,
        files: skills.filter((skill) => skill.path).length,
        registry: skills.filter((skill) => !skill.path).length,
      }
      const translateInfo = data.translate || null
      const unlabelledSkills = skills.filter((skill) => skill.description && !(zh[skill.name] || skill.zh))
      const canTranslate = isZh && Boolean(translateInfo && translateInfo.available) && unlabelledSkills.length > 0
      const translateModelLabel = translateInfo && translateInfo.provider && translateInfo.model
        ? translateInfo.provider + ' / ' + translateInfo.model
        : T.translateModelUnknown

      const flash = (name, kind) => {
        setFeedback({ name, kind })
        setTimeout(() => setFeedback((current) => (current.name === name && current.kind === kind ? { name: '', kind: '' } : current)), 1600)
      }

      const insert = async (skill) => {
        const text = triggerFor(skill, language)
        const ok = appendToDraft(sessionId, text)
        if (ok) {
          flash(skill.name, 'inserted')
          return
        }
        await copyText(text)
        flash(skill.name, 'copied-fallback')
      }

      const copy = async (skill) => {
        await copyText(triggerFor(skill, language))
        flash(skill.name, 'copied')
      }

      const toggleExclude = async (name, excluded) => {
        setExcludeError('')
        setBackupNote('')
        try {
          const response = await fetch(EXCLUDE_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, excluded }),
          })
          const payload = await response.json()
          if (payload && payload.ok) {
            if (payload.backup) setBackupNote(T.backupNotice + payload.backup)
            setUsageAll(null)
            setTick((value) => value + 1)
          } else {
            setExcludeError(String((payload && payload.error) || 'failed'))
          }
        } catch (error) {
          setExcludeError(String((error && error.message) || error))
        }
      }

      const togglePick = (name) => {
        setPicked((current) => (current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name]))
      }

      const applyBatch = async (situationId) => {
        if (picked.length === 0) return
        setClassifyError('')
        setBackupNote('')
        try {
          const response = await fetch(CLASSIFY_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ names: picked, situation: situationId }),
          })
          const payload = await response.json()
          if (payload && payload.ok) {
            if (payload.backup) setBackupNote(T.backupNotice + payload.backup)
            setPicked([])
            setBatchMode(false)
            setTick((value) => value + 1)
          } else {
            setClassifyError(String((payload && payload.error) || 'failed'))
          }
        } catch (error) {
          setClassifyError(String((error && error.message) || error))
        }
      }

      const exportOverride = async () => {
        setOverrideNotice('')
        try {
          const response = await fetch(OVERRIDE_ROUTE)
          const payload = await response.json()
          const text = JSON.stringify(payload?.data ?? {}, null, 2)
          await copyText(text)
          setOverrideNotice(T.exported)
        } catch (error) {
          setOverrideNotice(T.exportFailed + String((error && error.message) || error))
        }
      }

      const previewOverride = async (data) => {
        setImportError('')
        setPreviewError('')
        setPreview(null)
        setPendingPlan(null)
        setUndoNotice('')
        let parsed
        if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
          parsed = data
        } else {
          try {
            parsed = JSON.parse(importText)
          } catch (error) {
            setImportError(T.importFailed + 'JSON 解析失败')
            return
          }
        }
        setPreviewBusy(true)
        try {
          const response = await fetch(OVERRIDE_PREVIEW_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session: sessionId, data: parsed }),
          })
          const payload = await response.json()
          if (payload && payload.ok) {
            setPreview(payload)
            setPendingPlan(parsed)
          } else {
            setPreviewError(String((payload && payload.error) || 'failed'))
          }
        } catch (error) {
          setPreviewError(String((error && error.message) || error))
        }
        setPreviewBusy(false)
      }

      const resetPlan = () => {
        setImportOpen(true)
        setImportText('{}')
        setPreview(null)
        setPreviewError('')
        previewOverride({})
      }

      const clearPlan = () => {
        setPreview(null)
        setPendingPlan(null)
        setImportError('')
      }

      const importOverride = async () => {
        setImportError('')
        let parsed = pendingPlan
        if (parsed === null) {
          try {
            parsed = JSON.parse(importText)
          } catch (error) {
            setImportError(T.importFailed + 'JSON 解析失败')
            return
          }
        }
        setPreviewBusy(true)
        try {
          const response = await fetch(OVERRIDE_IMPORT_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ data: parsed }),
          })
          const payload = await response.json()
          if (payload && payload.ok) {
            setImportOpen(false)
            setImportText('')
            setPreview(null)
            setPendingPlan(null)
            setUndoNotice(T.applyDone)
            setTick((value) => value + 1)
          } else {
            setImportError(T.importFailed + String((payload && payload.error) || 'failed'))
          }
        } catch (error) {
          setImportError(T.importFailed + String((error && error.message) || error))
        }
        setPreviewBusy(false)
      }

      const undoOverride = async () => {
        setUndoNotice('')
        setUndoBusy(true)
        try {
          const response = await fetch(OVERRIDE_UNDO_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          })
          const payload = await response.json()
          if (payload && payload.ok) {
            setUndoNotice(T.undoDone)
            setTick((value) => value + 1)
          } else {
            setUndoNotice(T.undoNone)
          }
        } catch (error) {
          setUndoNotice(T.undoNone)
        }
        setUndoBusy(false)
      }

      const classify = async (skill, situationId) => {
        if (classifyBusy) return
        setClassifyBusy(true)
        setClassifyError('')
        setBackupNote('')
        try {
          const response = await fetch(CLASSIFY_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: skill.name, situation: situationId }),
          })
          const payload = await response.json()
          if (payload && payload.ok) {
            if (payload.backup) setBackupNote(T.backupNotice + payload.backup)
            setClassifying('')
            setTick((value) => value + 1)
          } else {
            setClassifyError(String((payload && payload.error) || 'failed'))
          }
        } catch (error) {
          setClassifyError(String((error && error.message) || error))
        }
        setClassifyBusy(false)
      }

      const runTranslate = async (names) => {
        const requested = Array.isArray(names)
          ? names.filter((name) => typeof name === 'string' && name !== '')
          : unlabelledSkills.map((skill) => skill.name)
        if (translating || requested.length === 0) return
        setTranslating(true)
        setTranslateError('')
        setTranslateNotice('')
        try {
          const response = await fetch(TRANSLATE_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session: sessionId, consent: true, names: requested }),
          })
          const payload = await response.json()
          if (payload && payload.zh) setZh((previous) => ({ ...previous, ...payload.zh }))
          if (payload && payload.ok) {
            if (rememberConsent) {
              rememberTranslateConsent()
              setTranslateConsent(true)
            }
            setTranslateOpen(false)
            if (payload.error && payload.translated > 0 && payload.skipped > 0) {
              setTranslateNotice(T.translatePartial(payload.translated, payload.skipped))
              setTranslateError(T.translateFailed + payload.error)
            } else {
              setTranslateNotice(payload.translated > 0 ? T.translateDone(payload.translated) : T.translateNone)
              if (payload.error) setTranslateError(T.translateFailed + payload.error)
            }
            setTick((value) => value + 1)
          } else {
            setTranslateError(T.translateFailed + String((payload && payload.error) || 'failed'))
          }
        } catch (error) {
          setTranslateError(T.translateFailed + String((error && error.message) || error))
        }
        setTranslating(false)
      }

      const startTranslate = () => {
        if (translating) return
        if (translateConsent) {
          runTranslate()
          return
        }
        setTranslateOpen(true)
        setTranslateError('')
        setTranslateNotice('')
      }

      const retranslate = async (skill) => {
        try {
          await fetch(TRANSLATE_FORGET_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session: sessionId, names: [skill.name] }),
          })
        } catch (error) {
          /* even a failed forget is followed by an explicit translate */
        }
        setZh((previous) => {
          const next = { ...previous }
          delete next[skill.name]
          return next
        })
        await runTranslate([skill.name])
      }

      const copyOrigin = async (skill) => {
        const origin = originFor(skill)
        if (!origin) return
        await copyText(origin)
        flash(skill.name + '#origin', 'copied')
      }

      const activeUsage = usageScope === 'all' && usageAll !== null ? usageAll : data.usage
      const {
        usageBySkill,
        manualUsage,
        usedNames,
        modelCalls,
        manualTotal,
        failedCalls,
        usageUnavailable,
        partialScan,
        topSkills,
        topMax,
        topManual,
        manualMax,
      } = deriveUsageView(activeUsage)
      const usageProfile = classifyUsage(activeUsage, skills)
      const situationUsage = classifySituations(skills, activeUsage)
      const showStarter = data.status === 'ready' && (starterOpen || usageProfile.counts.auto + usageProfile.counts.workflow === 0)
      const skillChanges = data.skillsChanges || null
      const addedSkills = (skillChanges && skillChanges.added) || []
      const removedSkills = (skillChanges && skillChanges.removed) || []
      const newNames = new Set(addedSkills.map((skill) => skill.name))
      const hasSkillChanges = addedSkills.length + removedSkills.length > 0
      const pruneRemoved = async () => {
        if (removedSkills.length === 0) return
        try {
          const response = await fetch(OVERRIDE_PRUNE_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session: sessionId, names: removedSkills.map((skill) => skill.name) }),
          })
          const payload = await response.json()
          if (payload && payload.ok) {
            setOverrideNotice(T.pruneDone)
            setTick((value) => value + 1)
          } else {
            setOverrideNotice(T.pruneFailed + String((payload && payload.error) || 'failed'))
          }
        } catch (error) {
          setOverrideNotice(T.pruneFailed + String((error && error.message) || error))
        }
      }

      const acknowledgeChanges = async () => {        try {
          const response = await fetch(SKILLS_ACK_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session: sessionId }),
          })
          const payload = await response.json()
          if (payload && payload.ok) {
            setData((previous) => ({ ...previous, skillsChanges: { added: [], removed: [] } }))
          }
        } catch (error) {
          /* the banner simply stays */
        }
      }
      const pluginHealth = diag.data && diag.data.plugins ? diag.data.plugins : null

      const runDiagnose = async () => {
        setDiag((prev) => ({ status: 'loading', data: prev.data, error: '' }))
        try {
          const params = new URLSearchParams()
          if (sessionId) params.set('session', sessionId)
          if (language) params.set('lang', language)
          const url = DIAG_ROUTE + (params.toString() ? '?' + params.toString() : '')
          const payload = await (await fetch(url)).json()
          if (payload && payload.ok) setDiag({ status: 'ready', data: payload, error: '' })
          else setDiag({ status: 'error', data: null, error: String((payload && payload.error) || T.diagFailed) })
        } catch (error) {
          setDiag({ status: 'error', data: null, error: String((error && error.message) || error) })
        }
      }

      const copyReport = async () => {
        if (!diag.data || !diag.data.text) return
        await copyText(diag.data.text)
        setReportCopied(true)
        setTimeout(() => setReportCopied(false), 1600)
      }

      const toggleScope = async () => {
        if (usageScope === 'all') {
          setUsageScope('session')
          return
        }
        setUsageScope('all')
        if (usageAll !== null) return
        setUsageLoading(true)
        try {
          const params = new URLSearchParams({ scope: 'all' })
          if (sessionId) params.set('session', sessionId)
          const payload = await (await fetch(USAGE_ROUTE + '?' + params.toString())).json()
          setUsageAll(payload && payload.ok ? payload : null)
        } catch (error) {
          setUsageAll(null)
        }
        setUsageLoading(false)
      }
      const missingCatalog = ((data.capabilities && data.capabilities.missing) || [])        .filter((capability) => capability.role === 'catalog')
        .map((capability) => (isZh ? capability.label : capability.labelEn))
        .join(' / ')

      const ago = (ts) => {
        if (!ts) return ''
        const diff = Date.now() - ts
        if (diff < 60000) return T.justNow
        const minutes = Math.floor(diff / 60000)
        if (minutes < 60) return T.minutesAgo(minutes)
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return T.hoursAgo(hours)
        return T.daysAgo(Math.floor(hours / 24))
      }

      const calledSkills = [...new Set([...Object.keys(usageBySkill), ...Object.keys(manualUsage)])]
        .map((name) => ({
          name,
          model: usageBySkill[name] ?? 0,
          manual: manualUsage[name] ?? 0,
          last: Math.max(
            (activeUsage && activeUsage.lastByName && activeUsage.lastByName[name]) || 0,
            (activeUsage && activeUsage.manualLastByName && activeUsage.manualLastByName[name]) || 0,
          ),
        }))
        .sort((a, b) => (b.model + b.manual) - (a.model + a.manual))

      const { unusedSkills, unusedGroups } = groupUnused(skills, usedNames, data.situations)

      const { vagueSkills, vagueSet } = triggerAudit(skills)



      const diagnoseView = {
        T,
        isZh,
        diag,
        onSituation: (id) => {
          setSituationFilter(id)
          setMode('all')
          setView('skills')
        },
        pluginHealth,
        situations: data.situations,
        reportCopied,
        importOpen,
        importText,
        importError,
        preview,
        previewError,
        previewBusy,
        undoBusy,
        undoNotice,
        overrideNotice,
        backupNote,
        usageScope,
        usageLoading,
        activeUsage,
        topSkills,
        topMax,
        topManual,
        manualMax,
        modelCalls,
        manualTotal,
        failedCalls,
        partialScan,
        usageUnavailable,
        calledSkills,
        unusedSkills,
        unusedGroups,
        usageProfile,
        situationUsage,
        showUnused,
        vagueSkills,
        excludeError,
        ago,
        runDiagnose,
        copyReport,
        toggleScope,
        toggleExclude,
        exportOverride,
        setImportOpen,
        setImportText,
        setImportError,
        importOverride,
        previewOverride,
        resetPlan,
        clearPlan,
        undoOverride,
        setShowUnused,
        setMode,
        setView,
        copyText,
        setOverrideNotice,
      }
      const renderDiagnose = () => renderDiagnoseView(diagnoseView)

      const visible = filterSkills(skills, query, mode, vagueSet, situationFilter, new Set([
        ...usageProfile.auto.map((item) => item.name),
        ...usageProfile.workflow.map((item) => item.name),
      ]))
      const ordered = groupSkills(visible, data.situations)

      const chips = buildChips(T, counts, vagueSkills.length, usageProfile.counts.idle)
      const situationLabel = (id) => {
        const match = (data.situations || []).find((item) => item.id === id)
        return match ? match.title : id
      }

      const showBanner = mode === 'all' && counts.manual > 0 && data.status === 'ready'

      const cardView = {
        T,
        isZh,
        zh,
        language,
        batchMode,
        picked,
        feedback,
        classifying,
        classifyBusy,
        classifyError,
        situations: data.situations,
        vagueSet,
        newNames,
        togglePick,
        insert,
        copy,
        retranslate,
        copyOrigin,
        classify,
        setClassifying,
      }
      const renderCard = (skill) => renderSkillCard(cardView, skill)

      const switchNode = h('div', { className: 'sd-switch' },
        h('button', { type: 'button', className: 'sd-switch-btn' + (view === 'skills' ? ' is-on' : ''), onClick: () => setView('skills') }, T.viewSkills),
        h('button', { type: 'button', className: 'sd-switch-btn' + (view === 'diagnose' ? ' is-on' : ''), onClick: () => setView('diagnose') }, T.viewDiagnose),
      )

      if (view === 'diagnose') {
        return h('div', { className: 'sd-root' },
          h('div', { className: 'sd-head' },
            h('div', { className: 'sd-eyebrow' }, T.eyebrow),
            h('div', { className: 'sd-title' }, T.title),
            h('div', { className: 'sd-sub' }, T.subtitle(counts.total, counts.manual)),
            switchNode,
          ),
          renderDiagnose(),
        )
      }

      return h('div', { className: 'sd-root' },
        h('div', { className: 'sd-head' },
          h('div', { className: 'sd-eyebrow' }, T.eyebrow),
          h('div', { className: 'sd-title' }, T.title),
          h('div', { className: 'sd-sub' }, T.subtitle(counts.total, counts.manual)),
          switchNode,
        ),

        h('div', { className: 'sd-batch' },
          h('button', {
            type: 'button',
            className: 'sd-btn-sm' + (batchMode ? ' is-on' : ''),
            onClick: () => {
              setBatchMode((value) => !value)
              setPicked([])
            },
          }, batchMode ? T.batchCancel : T.batchStart),
          batchMode ? h('span', { className: 'sd-status-note' }, T.batchPicked(picked.length)) : null,
          batchMode && picked.length > 0
            ? h('div', { className: 'sd-classify' },
                data.situations.map((situation) =>
                  h('button', {
                    key: situation.id,
                    type: 'button',
                    className: 'sd-chip',
                    onClick: () => applyBatch(situation.id),
                  }, situation.title),
                ),
                classifyError ? h('div', { className: 'sd-classify-error' }, T.batchFailed + classifyError) : null,
              )
            : null,
        ),

        h('div', { className: 'sd-sticky' },
          h('div', { className: 'sd-search-row' },
            h('div', { className: 'sd-search-wrap' },
              h(IconSearch),
              h('input', {
                className: 'sd-search',
                type: 'search',
                value: query,
                placeholder: T.search,
                onChange: (event) => setQuery(event.target.value),
              }),
            ),
            h('button', {
              type: 'button',
              className: 'sd-icon-btn',
              title: T.refresh,
              onClick: () => setTick((value) => value + 1),
            }, h(IconRefresh)),
          ),
          h('div', { className: 'sd-chips' },
            chips.map((chip) => h('button', {
              key: chip.value,
              type: 'button',
              className: 'sd-chip',
              'data-chip': chip.chip || chip.value,
              'aria-pressed': mode === chip.value ? 'true' : 'false',
              onClick: () => setMode(chip.value),
            }, chip.label, h('span', { className: 'sd-chip-n' }, String(chip.count)))),
          ),
        ),

        situationFilter
          ? h('div', { className: 'sd-status-row' },
              h('span', { className: 'sd-status-note' }, T.situationFilterLabel + situationLabel(situationFilter)),
              h('button', {
                type: 'button',
                className: 'sd-btn-sm',
                onClick: () => setSituationFilter(''),
              }, T.clearFilter),
            )
          : null,

        hasSkillChanges
          ? h('div', { className: 'sd-notice' },
              h('div', { className: 'sd-banner-title' }, T.changesTitle),
              addedSkills.length > 0
                ? h('div', { className: 'sd-banner-body' },
                    T.changesAdded(addedSkills.length) +
                    addedSkills.slice(0, 8).map((skill) => skill.name).join('、') +
                    (addedSkills.length > 8 ? '…' : ''))
                : null,
              removedSkills.length > 0
                ? h('div', { className: 'sd-banner-body' },
                    T.changesRemoved(removedSkills.length) +
                    removedSkills.slice(0, 8).map((skill) => skill.name).join('、') +
                    (removedSkills.length > 8 ? '…' : ''))
                : null,
              h('div', { className: 'sd-status-row' },
                h('button', { type: 'button', className: 'sd-btn-sm', onClick: acknowledgeChanges }, T.changesAck),
                removedSkills.length > 0
                  ? h('button', { type: 'button', className: 'sd-btn-sm', onClick: pruneRemoved }, T.pruneRemoved)
                  : null,
              ),
            )
          : null,

        showStarter
          ? renderStarterGuide({ T, isZh, zh, language, skills, usageProfile, insert, copy, setTranslateOpen, setView })
          : null,

        data.status === 'ready' && !showStarter
          ? h('div', { className: 'sd-status-row' },
              h('button', {
                type: 'button',
                className: 'sd-btn-sm',
                onClick: () => setStarterOpen(true),
              }, T.starterOpen),
            )
          : null,

        canTranslate && !translateOpen
          ? h('div', { className: 'sd-translate-banner' },
              h('div', { className: 'sd-banner-title' }, T.translateBannerTitle),
              h('div', { className: 'sd-banner-body' }, T.translateBannerBody(
                Math.min(unlabelledSkills.length, (translateInfo && translateInfo.limit) || unlabelledSkills.length),
                translateModelLabel,
              )),
              h('div', { className: 'sd-status-row' },
                h('button', {
                  type: 'button',
                  className: 'sd-btn-sm is-primary',
                  onClick: startTranslate,
                }, T.translateOneClick),
              ),
            )
          : null,

        translateOpen
          ? h('div', { className: 'sd-import', style: { marginTop: '8px' } },
              h('div', { className: 'sd-status-note' }, T.translateTitle),
              h('div', { className: 'sd-status-note' },
                T.translateBody(
                  Math.min(unlabelledSkills.length, (translateInfo && translateInfo.limit) || unlabelledSkills.length),
                  (translateInfo && translateInfo.chars) || 0,
                  translateModelLabel,
                )),
              h('div', { className: 'sd-status-note' }, T.translatePrivacy),
              h('label', { className: 'sd-check' },
                h('input', {
                  type: 'checkbox',
                  checked: rememberConsent,
                  onChange: (event) => setRememberConsent(event.target.checked),
                }),
                h('span', null, T.translateRemember),
              ),
              h('div', { className: 'sd-status-row' },
                h('button', {
                  type: 'button',
                  className: 'sd-btn-sm is-primary',
                  disabled: translating,
                  onClick: runTranslate,
                }, translating ? T.translating : T.translateStart),
                h('button', {
                  type: 'button',
                  className: 'sd-btn-sm',
                  disabled: translating,
                  onClick: () => setTranslateOpen(false),
                }, T.translateCancel),
                translateError ? h('span', { className: 'sd-status-err' }, translateError) : null,
              ),
            )
          : null,

        translateNotice || translateError
          ? h('div', { className: 'sd-status-row' },
              translateNotice ? h('span', { className: 'sd-status-note' }, translateNotice) : null,
              translateError ? h('span', { className: 'sd-status-err' }, translateError) : null,
            )
          : null,

        data.overrideNote ? h('div', { className: 'sd-notice' }, data.overrideNote) : null,
        backupNote ? h('div', { className: 'sd-notice' }, backupNote) : null,
        data.stale ? h('div', { className: 'sd-banner' }, h('div', { className: 'sd-banner-body' }, T.stale)) : null,

        showBanner
          ? h('div', { className: 'sd-banner' },
              h('div', { className: 'sd-banner-title' }, T.manualBannerTitle),
              h('div', { className: 'sd-banner-body' }, T.manualBannerBody),
            )
          : null,

        data.status === 'loading'
          ? h('div', { className: 'sd-grid', style: { marginTop: '12px' } },
              [0, 1, 2, 3, 4, 5].map((index) => h('div', { className: 'sd-skeleton', key: index })),
            )
          : data.status === 'error'
            ? h('div', { className: 'sd-empty' },
                h('div', { className: 'sd-empty-title sd-err' }, T.error),
                h('div', { className: 'sd-empty-hint' }, data.error || ''),
                h('button', { type: 'button', className: 'sd-chip', onClick: () => setTick((value) => value + 1) }, T.retry),
              )
            : data.problem
              ? h('div', { className: 'sd-empty' },
                  h('div', { className: 'sd-empty-title sd-err' }, T.noDataTitle),
                  missingCatalog ? h('div', { className: 'sd-empty-hint' }, T.noDataBody) : null,
                  missingCatalog ? h('div', { className: 'sd-empty-hint' }, missingCatalog) : null,
                  h('div', { className: 'sd-empty-hint' }, T.versionHint),
                  h('button', { type: 'button', className: 'sd-chip', onClick: () => setTick((value) => value + 1) }, T.retry),
                )
              : visible.length === 0
              ? h('div', { className: 'sd-empty' },
                  h('div', { className: 'sd-empty-title' }, T.empty),
                  h('div', { className: 'sd-empty-hint' }, T.emptyHint),
                )
              : ordered.map((situation) =>
                  h('div', { className: 'sd-group', key: situation.id },
                    h('div', { className: 'sd-group-head' },
                      h('span', { className: 'sd-group-title' }, situation.title),
                      h('span', { className: 'sd-group-count' }, String(situation.items.length)),
                      h('span', { className: 'sd-group-rule' }),
                    ),
                    situation.id === 'other' ? h('div', { className: 'sd-group-note' }, T.unmapped) : null,
                    h('div', { className: 'sd-grid' }, situation.items.map(renderCard)),
                  ),
                ),
      )
    }

    function TabTitle() {
      return h('span', null, stringsFor(activeLanguage()).tab)
    }

    // --------------------------------------------------------- header button
    let rightbar = null
    let hostCtx = null

    function appendToDraft(sessionId, text) {
      try {
        if (!hostCtx || !sessionId) return false
        const actx = hostCtx.sessions?.scope?.(sessionId)
        if (!actx) return false
        const conversation = hostCtx.get?.('conversation')
        const input = conversation?.input?.for?.(actx)
        if (!input) return false
        const snapshot = input.state?.getSnapshot?.()
        if (!snapshot) return false
        // A draft carrying chips (references, slash commands) must not go
        // through setDraft: it rebuilds the document from plain text and would
        // flatten every chip. Refuse, and let the caller copy instead.
        const hasChips = (snapshot.occurrences?.length ?? 0) > 0 || snapshot.phase === 'claimed'
        if (hasChips) return false
        const draft = typeof snapshot.draft === 'string' ? snapshot.draft : ''
        input.setDraft(appendText(draft, text))
        return true
      } catch (error) {
        console.warn('skill-dashboard: cannot write the composer draft', error)
        return false
      }
    }

    function openDashboard() {
      if (!rightbar) return
      const open = () => {
        try {
          rightbar.openTab?.(TAB_KIND)
        } catch (error) {
          console.warn('skill-dashboard: cannot open the tab', error)
        }
      }
      // A collapsed column has nothing to open a tab into, and `openTab` does
      // not throw for it — it just does nothing. Expand first, then open.
      let expanded = true
      try {
        if (typeof rightbar.isExpanded === 'function') expanded = rightbar.isExpanded()
      } catch (error) {
        expanded = true
      }
      if (!expanded) {
        try {
          rightbar.toggleExpanded()
        } catch (error) {
          console.warn('skill-dashboard: cannot expand the right column', error)
        }
        setTimeout(open, 220)
        return
      }
      open()
    }

    function OpenButton() {
      const strings = stringsFor(activeLanguage())
      return h('button', {
        type: 'button',
        className: 'sd-hbtn',
        title: strings.open,
        onClick: openDashboard,
      }, strings.tab)
    }

    // ------------------------------------------------------------- lifecycle
    function installStyles(ctx) {
      try {
        if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') {
          ctx.effect(() => styles.insert(CSS), 'skill-dashboard: styles')
          return
        }
      } catch (error) {
        console.error('skill-dashboard: styles.insert unavailable', error)
      }
      ctx.effect(() => {
        const element = document.createElement('style')
        element.setAttribute('data-plugin', 'dsh-skill-dashboard')
        element.setAttribute('data-plugin-css', 'dsh-skill-dashboard/dashboard.css')
        element.textContent = CSS
        document.head.appendChild(element)
        return () => {
          try {
            element.remove()
          } catch (error) {
            /* already detached */
          }
        }
      }, 'skill-dashboard: styles (fallback)')
    }

    const inject = ['slots', 'sidebarRightTabs', 'sidebarRight', 'sessions', 'conversation']

    function apply(ctx) {
        installStyles(ctx)

        hostCtx = ctx
        rightbar = ctx.get('sidebarRight') ?? null
        const tabs = ctx.get('sidebarRightTabs')

        if (tabs && typeof tabs.register === 'function') {
          ctx.effect(() => tabs.register({
            id: TAB_ID,
            kind: TAB_KIND,
            title: () => stringsFor(activeLanguage()).tab,
            keepMounted: true,
            guide: [{
              id: TAB_ID,
              order: 20,
              title: () => stringsFor(activeLanguage()).tab,
              description: () => stringsFor(activeLanguage()).guideDesc,
              icon: (props) => h(GuideIcon, props || {}),
            }],
          }), 'skill-dashboard: tab type')

          ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
          }, Dashboard))

          ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
            name: 'sidebar.right.pane.tab.title',
            key: TAB_ID,
          }, TabTitle))
        } else {
          console.error('skill-dashboard: sidebarRightTabs unavailable')
        }

        if (rightbar) {
          ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
            name: 'conversation.session.header.utilities',
            id: 'dsh-skill-dashboard:open',
            order: 14,
            label: () => stringsFor(activeLanguage()).tab,
          }, OpenButton))
        }
    }

    // The host reads only inject/apply. Tests opt into the pure surface so the
    // filter, audit and usage derivations can be exercised without a browser.
    if (globalThis.__DSH_SKILL_DASHBOARD_TEST__ === true) {
      return {
        inject,
        apply,
        __internals: {
          firstSentence,
          triggerFor,
          originFor,
          renderSkillCard,
          appendText,
          deriveUsageView,
          classifyUsage,
          classifySituations,
          pickStarterSkills,
          triggerAudit,
          filterSkills,
          groupSkills,
          groupUnused,
          buildChips,
        },
      }
    }
    return { inject, apply }
  },
})
