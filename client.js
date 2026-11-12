window.__ModuleLoader__.load({
  id: 'dsh-skill-dashboard',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const TAB_ID = 'dsh-skill-dashboard'
    const TAB_KIND = 'skill-dashboard'
    const ROUTE = '/api/skill-dash/data'
    const ZH_ROUTE = '/api/skill-dash/zh'
    const DIAG_ROUTE = '/api/skill-dash/diagnose'
    const USAGE_ROUTE = '/api/skill-dash/usage'
    const CLASSIFY_ROUTE = '/api/skill-dash/classify'
    const FALLBACK_SITUATIONS = [{ id: 'other', title: '其他', order: 999 }]

    // ------------------------------------------------------------------ i18n
    const STRINGS_ZH = {
          tab: '技能',
          open: '技能上手台',
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
          manualBannerBody: '只有你开口点名才会用到。点「需点名」只看它们，右边的触发语一键写进输入框。',
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
          partialScan: (done, total) => `只扫了 ${done}/${total} 个会话（超时）`,
          sessionLabel: '本会话',
          sessionUsage: (skills, calls) => `用过 ${skills} 个技能 · ${calls} 次调用`,
          sessionFailed: (n) => `（${n} 次失败）`,
          sessionOnlyFailed: (n) => `${n} 次尝试都失败`,
          sessionEmpty: '还没调用过技能',
          noDataTitle: '读不到技能清单',
          noDataBody: '当前 DSH 缺少这些能力：',
          versionHint: '多半是 DSH 版本不匹配——插件依赖的宿主服务在这个版本里不存在。',
    }

    const STRINGS_EN = {
          tab: 'Skills',
          open: 'Skill dashboard',
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
          manualBannerBody: 'They only run when you name them. Pick “Name-only”, then insert a trigger into the composer.',
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
          partialScan: (done, total) => `scanned ${done}/${total} sessions (timed out)`,
          sessionLabel: 'This session',
          sessionUsage: (skills, calls) => `${skills} skills · ${calls} calls`,
          sessionFailed: (n) => ` (${n} failed)`,
          sessionOnlyFailed: (n) => `all ${n} attempts failed`,
          sessionEmpty: 'No skill call yet in this session',
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
      const cut = clean.split(/[.。!！?？]\s/)[0]
      return (cut || clean).slice(0, 120)
    }

    function triggerFor(skill, language) {
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
  display: grid; grid-template-columns: minmax(0, 1fr) 34px 64px;
  align-items: center; gap: 6px; padding: 2px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.sd-tname {
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sd-tcount { font-size: 10.5px; text-align: right; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
.sd-tlast { font-size: 9.5px; text-align: right; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
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
.sd-bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--dsw-alias-brand-primary); opacity: .75; }
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
`

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
      const T = stringsFor(language)
      const [data, setData] = React.useState({ status: 'loading', skills: [], situations: FALLBACK_SITUATIONS, counts: null, error: '', stale: false, overrideNote: '', capabilities: null, problem: null, plugins: null, usage: null })
      const [query, setQuery] = React.useState('')
      const [mode, setMode] = React.useState('all')
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
      const [tick, setTick] = React.useState(0)
      const [zh, setZh] = React.useState({})

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
              })
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

      const skills = data.skills || []
      const counts = data.counts || {
        total: skills.length,
        manual: skills.filter((skill) => skill.modelInvocable === false).length,
        files: skills.filter((skill) => skill.path).length,
        registry: skills.filter((skill) => !skill.path).length,
      }

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

      const classify = async (skill, situationId) => {
        if (classifyBusy) return
        setClassifyBusy(true)
        setClassifyError('')
        try {
          const response = await fetch(CLASSIFY_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: skill.name, situation: situationId }),
          })
          const payload = await response.json()
          if (payload && payload.ok) {
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

      const copyOrigin = async (skill) => {
        const origin = originFor(skill)
        if (!origin) return
        await copyText(origin)
        flash(skill.name + '#origin', 'copied')
      }

      const isZh = /^zh/i.test(language || '')
      const activeUsage = usageScope === 'all' && usageAll !== null ? usageAll : data.usage
      const usageBySkill = (activeUsage && activeUsage.byName) || {}
      const usedSkills = Object.keys(usageBySkill).length
      const usedCalls = (activeUsage && activeUsage.total) || 0
      const failedCalls = (activeUsage && activeUsage.failed) || 0
      const usageText = !activeUsage
        ? ''
        : usedSkills === 0 && usedCalls === 0
          ? failedCalls > 0
            ? T.sessionOnlyFailed(failedCalls)
            : T.sessionEmpty
          : T.sessionUsage(usedSkills, usedCalls) + (failedCalls > 0 ? T.sessionFailed(failedCalls) : '')
      const topSkills = Object.entries(usageBySkill)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      const topMax = topSkills.length > 0 ? topSkills[0][1] : 1
      const unusedCount = Math.max(0, skills.length - usedSkills)
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

      const calledSkills = Object.entries(usageBySkill)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          count,
          last: (activeUsage && activeUsage.lastByName && activeUsage.lastByName[name]) || 0,
        }))

      const unusedSkills = skills.filter((skill) => !usageBySkill[skill.name])
      const situationTitle = {}
      for (const situation of data.situations) situationTitle[situation.id] = situation.title
      const unusedGroups = []
      for (const skill of unusedSkills) {
        const key = skill.situation || 'other'
        let group = unusedGroups.find((entry) => entry.id === key)
        if (group === undefined) {
          group = { id: key, title: situationTitle[key] || key, names: [] }
          unusedGroups.push(group)
        }
        group.names.push(skill.name)
      }

      const renderDiagnose = () => {
        const health = pluginHealth
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

          h('div', { className: 'sd-section-title' }, T.usageTitle),
          h('div', { className: 'sd-status-row' },
            h('span', { className: 'sd-pill' }, usageScope === 'all' ? T.allSessions : T.sessionLabel, ' ', usageText),
            h('button', {
              type: 'button',
              className: 'sd-btn-sm',
              disabled: usageLoading,
              onClick: toggleScope,
            }, usageLoading ? T.scanning : usageScope === 'all' ? T.scopeSession : T.scopeAll),
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
            : null,

          calledSkills.length > 0
            ? h('div', { className: 'sd-table' },
                calledSkills.map((entry) =>
                  h('div', { className: 'sd-trow', key: entry.name },
                    h('span', { className: 'sd-tname', title: entry.name }, entry.name),
                    h('span', { className: 'sd-tcount' }, String(entry.count)),
                    h('span', { className: 'sd-tlast' }, ago(entry.last)),
                  ),
                ),
              )
            : h('div', { className: 'sd-status-note' }, T.sessionEmpty),

          h('button', {
            type: 'button',
            className: 'sd-btn-sm',
            onClick: () => setShowUnused((value) => !value),
          }, (showUnused ? T.hideUnused : T.showUnused) + ' · ' + String(unusedSkills.length)),

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

      const needle = query.trim().toLowerCase()
      const visible = skills.filter((skill) => {
        if (needle) {
          const haystack = `${skill.name} ${skill.description} ${skill.whenToUse} ${skill.situation}`.toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        if (mode === 'manual') return skill.modelInvocable === false
        if (mode === 'files') return Boolean(skill.path)
        if (mode === 'registry') return !skill.path
        return true
      })

      const buckets = new Map()
      for (const skill of visible) {
        const key = skill.situation || 'other'
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key).push(skill)
      }
      const ordered = data.situations
        .filter((situation) => buckets.has(situation.id))
        .map((situation) => ({ ...situation, items: buckets.get(situation.id) }))

      const chips = [
        { value: 'all', label: T.all, count: counts.total },
        { value: 'manual', label: T.manual, count: counts.manual, chip: 'manual' },
        { value: 'files', label: T.files, count: counts.files },
        { value: 'registry', label: T.registry, count: counts.registry },
      ]

      const showBanner = mode === 'all' && counts.manual > 0 && data.status === 'ready'

      const renderCard = (skill) => {
        const manual = skill.modelInvocable === false
        const origin = originFor(skill)
        const busy = feedback.name === skill.name
        const originBusy = feedback.name === skill.name + '#origin'
        const translated = isZh ? zh[skill.name] || skill.zh || '' : ''
        const description = translated || skill.description
        return h('div', { className: 'sd-card' + (manual ? ' is-manual' : ''), key: skill.name },
          h('div', { className: 'sd-card-top' },
            h('code', { className: 'sd-name' }, skill.name),
            h('div', { className: 'sd-badges' },
              manual ? h('span', { className: 'sd-badge is-manual' }, T.badgeManual) : h('span', { className: 'sd-badge' }, T.badgeAuto),
              skill.situationSource === 'heuristic' ? h('span', { className: 'sd-badge' }, T.auto) : null,
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
          ),
          classifying === skill.name
            ? h('div', { className: 'sd-classify' },
                data.situations.map((situation) =>
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

        data.overrideNote ? h('div', { className: 'sd-notice' }, data.overrideNote) : null,
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

    return {
      inject: ['slots', 'sidebarRightTabs', 'sidebarRight', 'sessions', 'conversation'],
      apply(ctx) {
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
      },
    }
  },
})
