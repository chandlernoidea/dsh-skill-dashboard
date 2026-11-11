window.__ModuleLoader__.load({
  id: 'dsh-skill-dashboard',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const TAB_ID = 'dsh-skill-dashboard'
    const TAB_KIND = 'skill-dashboard'
    const ROUTE = '/api/skill-dash/data'
    const ZH_ROUTE = '/api/skill-dash/zh'
    const FALLBACK_SITUATIONS = [{ id: 'other', title: '其他', order: 999 }]

    // ------------------------------------------------------------------ i18n
    const ZH = typeof navigator !== 'undefined' && /^zh/i.test(navigator.language || '')
    const T = ZH
      ? {
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
        }
      : {
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
        }

    // --------------------------------------------------------------- helpers
    function firstSentence(text) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim()
      const cut = clean.split(/[.。!！?？]\s/)[0]
      return (cut || clean).slice(0, 120)
    }

    function triggerFor(skill) {
      if (skill.trigger) return skill.trigger
      const desc = firstSentence(skill.whenToUse || skill.description)
      return ZH ? `用 ${skill.name} 技能：${desc || '按你说的来'}` : `Use the ${skill.name} skill: ${desc || 'as described'}`
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
      const [data, setData] = React.useState({ status: 'loading', skills: [], situations: FALLBACK_SITUATIONS, counts: null, error: '', stale: false, overrideNote: '' })
      const [query, setQuery] = React.useState('')
      const [mode, setMode] = React.useState('all')
      const [feedback, setFeedback] = React.useState({ name: '', kind: '' })
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

      React.useEffect(() => {
        let alive = true
        const controller = typeof AbortController === 'function' ? new AbortController() : null

        const load = () => {
          const url = sessionId ? ROUTE + '?session=' + encodeURIComponent(sessionId) : ROUTE
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
      }, [tick, sessionId])

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
        const text = triggerFor(skill)
        const ok = appendToDraft(sessionId, text)
        if (ok) {
          flash(skill.name, 'inserted')
          return
        }
        await copyText(text)
        flash(skill.name, 'copied-fallback')
      }

      const copy = async (skill) => {
        await copyText(triggerFor(skill))
        flash(skill.name, 'copied')
      }

      const copyOrigin = async (skill) => {
        const origin = originFor(skill)
        if (!origin) return
        await copyText(origin)
        flash(skill.name + '#origin', 'copied')
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
        const translated = ZH ? zh[skill.name] || skill.zh || '' : ''
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
                h('div', { className: 'sd-trigger-text' }, triggerFor(skill)),
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
        )
      }

      return h('div', { className: 'sd-root' },
        h('div', { className: 'sd-head' },
          h('div', { className: 'sd-eyebrow' }, T.eyebrow),
          h('div', { className: 'sd-title' }, T.title),
          h('div', { className: 'sd-sub' }, T.subtitle(counts.total, counts.manual)),
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
      return h('span', null, T.tab)
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
      return h('button', {
        type: 'button',
        className: 'sd-hbtn',
        title: T.open,
        onClick: openDashboard,
      }, T.tab)
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
            title: () => T.tab,
            keepMounted: true,
            guide: [{
              id: TAB_ID,
              order: 20,
              title: () => T.tab,
              description: () => T.guideDesc,
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
            label: T.tab,
          }, OpenButton))
        }
      },
    }
  },
})
