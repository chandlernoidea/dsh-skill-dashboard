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

