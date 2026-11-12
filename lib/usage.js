/**
 * Count skill calls in one session's event list, then merge any number of
 * sessions into the single set of numbers the dashboard renders.
 *
 * Pure: the caller supplies the events, so a host read and a test feed the
 * same function. `composeUsage` is the only place that defines what `total`,
 * `failed` or an excluded skill mean — routes and the Client never do the
 * arithmetic themselves.
 *
 * Only calls that did not fail count as usage: the `skill` tool refuses
 * manual-only skills with an error, and counting those attempts would claim a
 * skill was used when it could not run at all.
 */

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function addCounts(target, source) {
  for (const [name, count] of Object.entries(source ?? {})) {
    if (typeof count !== 'number' || !Number.isFinite(count)) continue
    target[name] = (target[name] ?? 0) + count
  }
}

function keepLatest(target, source) {
  for (const [name, time] of Object.entries(source ?? {})) {
    if (typeof time !== 'number' || !Number.isFinite(time)) continue
    if (time > (target[name] ?? 0)) target[name] = time
  }
}

function omit(map, excluded) {
  if (excluded.size === 0) return { ...(map ?? {}) }
  const out = {}
  for (const [name, value] of Object.entries(map ?? {})) {
    if (!excluded.has(name)) out[name] = value
  }
  return out
}

function sum(map) {
  let total = 0
  for (const value of Object.values(map ?? {})) total += value
  return total
}

/**
 * @param {object[]|undefined} events - one session's event list
 * @returns {{
 *   modelTotal: number,
 *   manualTotal: number,
 *   failed: number,
 *   byName: Record<string, number>,
 *   manualByName: Record<string, number>,
 *   lastByName: Record<string, number>,
 *   manualLastByName: Record<string, number>,
 *   failedByName: Record<string, number>,
 * }}
 */
export function tallySkillUsage(events) {
  const failedCallIds = new Set()
  for (const event of events ?? []) {
    if (!isObject(event)) continue
    if (event.type !== 'tool/result') continue
    const data = event.data
    if (!isObject(data)) continue
    // A failed tool result shows up either as `error` on the event or as
    // `isError` on the result message, depending on who produced it.
    const failed = Boolean(data.error) || data.message?.isError === true
    if (!failed) continue
    const callId = data.message?.source?.callId
    if (typeof callId === 'string' && callId !== '') failedCallIds.add(callId)
  }

  const tally = {
    modelTotal: 0,
    manualTotal: 0,
    failed: 0,
    byName: {},
    manualByName: {},
    lastByName: {},
    manualLastByName: {},
    failedByName: {},
  }

  for (const event of events ?? []) {
    if (!isObject(event)) continue

    // A user's /name gesture arrives as an injected message, never as a tool
    // call, so this is an exact signal rather than a guess.
    const source = event.data?.message?.source ?? event.data?.source
    if (source?.kind === 'skill-invocation' && typeof source.name === 'string' && source.name !== '') {
      tally.manualTotal += 1
      tally.manualByName[source.name] = (tally.manualByName[source.name] ?? 0) + 1
      const when = typeof event.time === 'number' ? event.time : 0
      if (when > (tally.manualLastByName[source.name] ?? 0)) tally.manualLastByName[source.name] = when
      continue
    }

    if (event.type !== 'tool/call') continue
    const data = event.data
    if (!isObject(data)) continue
    if (data.name !== 'skill') continue

    let name = ''
    try {
      const args = JSON.parse(data.arguments ?? '{}')
      // The `skill` tool takes `name`; older recordings used `skill`.
      name = String(args?.name ?? args?.skill ?? '')
    } catch (error) {
      name = ''
    }
    if (name === '') continue

    if (typeof data.callId === 'string' && failedCallIds.has(data.callId)) {
      tally.failed += 1
      tally.failedByName[name] = (tally.failedByName[name] ?? 0) + 1
      continue
    }

    tally.byName[name] = (tally.byName[name] ?? 0) + 1
    tally.modelTotal += 1
    const time = typeof event.time === 'number' ? event.time : 0
    if (time > (tally.lastByName[name] ?? 0)) tally.lastByName[name] = time
  }

  return tally
}

/**
 * Merge per-session tallies into the payload the dashboard renders.
 *
 * `modelTotal` counts skill-tool calls, `manualTotal` counts `/name` gestures,
 * `total` is their sum, and `failed` counts attempts that were refused. The
 * excluded names are dropped from every number, so the totals can never
 * disagree with the per-skill maps.
 *
 * @param {object[]|undefined} tallies - zero or more `tallySkillUsage` results
 * @param {{ excluded?: Iterable<string>|undefined, partial?: boolean|undefined }} [options]
 */
export function composeUsage(tallies, { excluded, partial } = {}) {
  const skip = excluded instanceof Set ? excluded : new Set(excluded ?? [])
  const byName = {}
  const manualByName = {}
  const lastByName = {}
  const manualLastByName = {}
  const failedByName = {}

  for (const tally of tallies ?? []) {
    if (!isObject(tally)) continue
    addCounts(byName, tally.byName)
    addCounts(manualByName, tally.manualByName)
    addCounts(failedByName, tally.failedByName)
    keepLatest(lastByName, tally.lastByName)
    keepLatest(manualLastByName, tally.manualLastByName)
  }

  const shownByName = omit(byName, skip)
  const shownManualByName = omit(manualByName, skip)
  const modelTotal = sum(shownByName)
  const manualTotal = sum(shownManualByName)

  return {
    modelTotal,
    manualTotal,
    total: modelTotal + manualTotal,
    failed: sum(omit(failedByName, skip)),
    byName: shownByName,
    manualByName: shownManualByName,
    lastByName: omit(lastByName, skip),
    manualLastByName: omit(manualLastByName, skip),
    failedByName: omit(failedByName, skip),
    excluded: [...skip].sort(),
    partial: partial === true,
  }
}
