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
