function containsId(value, id) {
  if (value === id) return true;
  if (Array.isArray(value)) return value.some(item => containsId(item, id));
  return value && typeof value === "object" && Object.values(value).some(item => containsId(item, id));
}

// Remove only events with the exact account/subject pair, never an entire mixed batch.
function redactWebhook(body, account, subject) {
  if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.entry)) {
    if (containsId(body, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
    return { body, removed: 0 };
  }
  const result = structuredClone(body);
  let removed = 0;
  function retain(event) {
    const sender = event?.sender?.id, recipient = event?.recipient?.id;
    if ((sender === subject && recipient === account) || (sender === account && recipient === subject)) {
      removed++;
      return false;
    }
    // Same subject on another account is outside this deletion's scope.
    if ((sender === subject && typeof recipient === "string" && recipient !== account) ||
        (recipient === subject && typeof sender === "string" && sender !== account)) return true;
    if (containsId(event, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
    return true;
  }
  for (const entry of result.entry) {
    if ((!Array.isArray(entry?.messaging) && containsId(entry?.messaging, subject)) ||
        (!Array.isArray(entry?.changes) && containsId(entry?.changes, subject)))
      throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
    if (Array.isArray(entry?.messaging)) entry.messaging = entry.messaging.filter(retain);
    if (Array.isArray(entry?.changes)) entry.changes = entry.changes.filter(change => {
      if (change?.field !== "messages") {
        if (containsId(change, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
        return true;
      }
      if (Array.isArray(change.value?.messaging)) {
        change.value.messaging = change.value.messaging.filter(retain);
        return change.value.messaging.length > 0;
      }
      return retain(change.value);
    });
    // Unknown metadata must not silently retain a second copy of the subject.
    const { messaging, changes, ...metadata } = entry || {};
    if (containsId(metadata, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
  }
  const { entry, ...metadata } = result;
  if (containsId(metadata, subject)) throw Error("WEBHOOK_SCOPE_AMBIGUOUS");
  return { body: result, removed };
}

module.exports={redactWebhook};
