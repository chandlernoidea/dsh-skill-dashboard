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
