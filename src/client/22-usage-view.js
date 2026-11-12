    // ------------------------------------------------------------- usage view

    // One derivation for every number the usage section shows. It used to be
    // inline in the Dashboard, which made it untestable and let `total` and
    // `manualTotal` drift into the negative-number bug.
    function deriveUsageView(activeUsage) {
      const usageBySkill = (activeUsage && activeUsage.byName) || {}
      const manualUsage = (activeUsage && activeUsage.manualByName) || {}
      const usedNames = new Set([...Object.keys(usageBySkill), ...Object.keys(manualUsage)])
      const modelCalls = (activeUsage && activeUsage.modelTotal) || 0
      const manualTotal = activeUsage && typeof activeUsage.manualTotal === 'number'
        ? activeUsage.manualTotal
        : Object.values(manualUsage).reduce((sum, count) => sum + count, 0)
      const failedCalls = (activeUsage && activeUsage.failed) || 0
      const usageUnavailable = Boolean(activeUsage) && activeUsage.available === false
      const partialScan = Boolean(activeUsage) && activeUsage.partial === true
      const topSkills = Object.entries(usageBySkill)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      const topMax = topSkills.length > 0 ? topSkills[0][1] : 1
      const topManual = Object.entries(manualUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      const manualMax = topManual.length > 0 ? topManual[0][1] : 1
      return {
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
      }
    }
