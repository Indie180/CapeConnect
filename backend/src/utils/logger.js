export function log(level, message, meta = {}) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...meta,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

export function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function serializeError(err) {
  if (!err) return {};
  return {
    name: err.name || "Error",
    message: err.message || "Unknown error",
    stack: err.stack || null,
    statusCode: err.statusCode || err.status || null,
  };
}
