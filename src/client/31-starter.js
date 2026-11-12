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
