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

