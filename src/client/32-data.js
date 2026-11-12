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
