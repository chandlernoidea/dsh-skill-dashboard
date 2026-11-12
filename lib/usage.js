/**
 * Count skill calls in a session's event list. Pure: the caller supplies the
 * events, so a host read and a test feed the same function.
 *
 * Only calls that did not fail count as usage: the `skill` tool refuses
 * manual-only skills with an error, and counting those attempts would claim a
 * skill was used when it could not run at all.
 */
export function tallySkillUsage(events) {
  const failedCallIds = new Set()
  for (const event of events ?? []) {
    if (event === null || typeof event !== 'object') continue
    if (event.type !== 'tool/result') continue
    const data = event.data
    if (data === null || typeof data !== 'object') continue
    // A failed tool result shows up either as `error` on the event or as
    // `isError` on the result message, depending on who produced it.
    const failed = Boolean(data.error) || data.message?.isError === true
    if (!failed) continue
    const callId = data.message?.source?.callId
    if (typeof callId === 'string' && callId !== '') failedCallIds.add(callId)
  }

  const byName = {}
  const lastByName = {}
  const namedByName = {}
  let total = 0
  let failed = 0
  let lastUserText = ''

  for (const event of events ?? []) {
    if (event === null || typeof event !== 'object') continue

    if (event.type === 'user/message') {
      // Cheapest reliable-enough signal: the text of the turn's user message.
      try {
        lastUserText = JSON.stringify(event.data ?? {}).toLowerCase()
      } catch (error) {
        lastUserText = ''
      }
      continue
    }

    if (event.type !== 'tool/call') continue
    const data = event.data
    if (data === null || typeof data !== 'object') continue
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
      failed += 1
      continue
    }

    byName[name] = (byName[name] ?? 0) + 1
    // Whether the user named it: a heuristic, not a recorded fact.
    if (lastUserText !== '' && lastUserText.includes(name.toLowerCase())) {
      namedByName[name] = (namedByName[name] ?? 0) + 1
    }
    const time = typeof event.time === 'number' ? event.time : 0
    if (time > (lastByName[name] ?? 0)) lastByName[name] = time
    total += 1
  }

  return { total, byName, failed, lastByName, namedByName }
}
