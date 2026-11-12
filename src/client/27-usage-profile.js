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
