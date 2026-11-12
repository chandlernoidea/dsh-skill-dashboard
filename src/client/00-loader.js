window.__ModuleLoader__.load({
  id: 'dsh-skill-dashboard',
  factory(require) {
    // One file by necessity: the host serves this module as-is, with no bundler
    // between the package and the browser. Sections, in order:
    //   1. routes + constants
    //   2. STRINGS_ZH / STRINGS_EN dictionaries
    //   3. pure helpers (language, firstSentence, triggerFor, originFor)
    //   4. installStyles — the whole `.sd-*` stylesheet, injected once
    //   5. the tab-type registration (body + title + header button)
    //   6. Dashboard: state, writers (classify / exclude / import), derived data
    //   7. renderDiagnose — plugin health, usage table, override import/export
    //   8. renderCard + the skills list
    // Anything worth sharing with the host lives in lib/ instead.
    const React = require('react')
    const h = React.createElement

    const TAB_ID = 'dsh-skill-dashboard'
    const TAB_KIND = 'skill-dashboard'
    const ROUTE = '/api/skill-dash/data'
    const ZH_ROUTE = '/api/skill-dash/zh'
    const DIAG_ROUTE = '/api/skill-dash/diagnose'
    const USAGE_ROUTE = '/api/skill-dash/usage'
    const CLASSIFY_ROUTE = '/api/skill-dash/classify'
    const EXCLUDE_ROUTE = '/api/skill-dash/exclude'
    const OVERRIDE_ROUTE = '/api/skill-dash/override'
    const OVERRIDE_IMPORT_ROUTE = '/api/skill-dash/override/import'
    const OVERRIDE_PRUNE_ROUTE = '/api/skill-dash/override/prune'
    const OVERRIDE_PREVIEW_ROUTE = '/api/skill-dash/override/preview'
    const OVERRIDE_UNDO_ROUTE = '/api/skill-dash/override/undo'
    const TRANSLATE_ROUTE = '/api/skill-dash/translate'
    const TRANSLATE_FORGET_ROUTE = '/api/skill-dash/translate/forget'
    const SKILLS_ACK_ROUTE = '/api/skill-dash/skills/ack'
    const FALLBACK_SITUATIONS = [{ id: 'other', title: '其他', order: 999 }]

