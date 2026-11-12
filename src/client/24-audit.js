    // ------------------------------------------------------------ trigger audit

    // A description that never says when to use it cannot win a match.
    const WHEN_MARKERS = /(use when|when the user|use for|use before|when working|用于|适合|当.{0,6}时|时使用)/i

    const RULE_SNIPPET = [
      "## 技能优先",
      "",
      "开工前先看会话里的技能目录：只要某个技能的名字或描述命中当前任务，先用 `skill` 工具加载它，再动手。",
      "",
      "- 命中就加载，不要凭印象模仿它的做法。",
      "- 手动型技能不在目录里，只有用户写 `/名字` 时才加载，不要尝试替用户调用。",
      "- 加载后按它的流程走；与仓库约定冲突时以仓库约定为准，并说明冲突在哪。",
    ].join("\n")

    function isVagueSkill(skill) {
      // Manual-only skills are reached by `/name`, not by description matching.
      if (skill.modelInvocable === false) return false
      const text = (skill.description || '') + ' ' + (skill.whenToUse || '')
      return !WHEN_MARKERS.test(text)
    }

    function triggerAudit(skills) {
      const vagueSkills = (skills || []).filter(isVagueSkill)
      return { vagueSkills, vagueSet: new Set(vagueSkills.map((skill) => skill.name)) }
    }
