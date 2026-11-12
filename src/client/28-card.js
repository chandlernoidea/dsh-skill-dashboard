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
