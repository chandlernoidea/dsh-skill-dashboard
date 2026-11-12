    // --------------------------------------------------------------- helpers
    function firstSentence(text) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim()
      // Chinese sentences end with a full-width stop and usually no space, so
      // the old `[.。!！?？]\s` pattern never split them.
      const cut = clean.split(/[。！？!?]\s*|\.\s+/)[0]
      return (cut || clean).slice(0, 120)
    }

    function triggerFor(skill, language) {
      // A model-disabled skill can only be reached by a `/name` token in the
      // user's message, so that is the only trigger worth copying.
      if (skill.modelInvocable === false) return `/${skill.name}`
      if (skill.trigger) return skill.trigger
      const desc = firstSentence(skill.whenToUse || skill.description)
      const isZh = /^zh/i.test(language || '')
      return isZh ? `用 ${skill.name} 技能：${desc || '按你说的来'}` : `Use the ${skill.name} skill: ${desc || 'as described'}`
    }

    function originFor(skill) {
      if (skill.repo) return skill.repo
      if (skill.path) return skill.path
      return ''
    }

    function appendText(draft, text) {
      if (!draft) return text
      if (/\s$/.test(draft)) return draft + text
      return draft + ' ' + text
    }

    // The consent panel is shown once; the user can remember it and get a
    // genuinely one-click "translate" button afterwards. Stored in the web
    // client, not in the plugin's files.
    const TRANSLATE_CONSENT_KEY = 'dsh-skill-dashboard:translate-consent'

    function rememberedTranslateConsent() {
      try {
        return localStorage.getItem(TRANSLATE_CONSENT_KEY) === '1'
      } catch (error) {
        return false
      }
    }

    function rememberTranslateConsent() {
      try {
        localStorage.setItem(TRANSLATE_CONSENT_KEY, '1')
      } catch (error) {
        /* private mode or no storage: the panel simply shows again */
      }
    }

    async function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch (error) {
        /* fall through */
      }
      return false
    }

