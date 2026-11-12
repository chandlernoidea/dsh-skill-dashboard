    // ------------------------------------------------------------- view model

    function filterSkills(skills, query, mode, vagueSet, situation = '', usedNames = null) {
      const needle = String(query || '').trim().toLowerCase()
      return (skills || []).filter((skill) => {
        if (situation && skill.situation !== situation) return false
        if (needle) {
          const haystack = `${skill.name} ${skill.description} ${skill.whenToUse} ${skill.situation}`.toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        if (mode === 'manual') return skill.modelInvocable === false
        if (mode === 'files') return Boolean(skill.path)
        if (mode === 'registry') return !skill.path
        if (mode === 'vague') return vagueSet.has(skill.name)
        if (mode === 'unused') return usedNames === null ? true : !usedNames.has(skill.name)
        return true
      })
    }

    function groupSkills(skills, situations) {
      const buckets = new Map()
      for (const skill of skills) {
        const key = skill.situation || 'other'
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key).push(skill)
      }
      return situations
        .filter((situation) => buckets.has(situation.id))
        .map((situation) => ({ ...situation, items: buckets.get(situation.id) }))
    }

    function groupUnused(skills, usedNames, situations) {
      const unusedSkills = skills.filter((skill) => !usedNames.has(skill.name))
      const titles = {}
      for (const situation of situations) titles[situation.id] = situation.title
      const unusedGroups = []
      for (const skill of unusedSkills) {
        const key = skill.situation || 'other'
        let group = unusedGroups.find((entry) => entry.id === key)
        if (group === undefined) {
          group = { id: key, title: titles[key] || key, names: [] }
          unusedGroups.push(group)
        }
        group.names.push(skill.name)
      }
      return { unusedSkills, unusedGroups }
    }

    function buildChips(T, counts, vagueCount, unusedCount = 0) {
      return [
        { value: 'all', label: T.all, count: counts.total },
        { value: 'manual', label: T.manual, count: counts.manual, chip: 'manual' },
        { value: 'files', label: T.files, count: counts.files },
        { value: 'registry', label: T.registry, count: counts.registry },
        { value: 'vague', label: T.vague, count: vagueCount, chip: 'vague' },
        { value: 'unused', label: T.unusedFilter, count: unusedCount },
      ]
    }
