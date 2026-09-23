// Read-only fixture instrumentation: preserve fetch behavior and log only
// network error metadata, never request headers, credentials, bodies or URLs.
const original = globalThis.fetch;
globalThis.fetch = async (...args) => {
  try { return await original(...args); }
  catch (error) {
    const describe = value => value && ({ name: value.name, message: value.message,
      code: value.code, syscall: value.syscall, address: value.address, port: value.port,
      cause: value.cause ? describe(value.cause) : undefined });
    console.error('ISOLATION_FETCH_ERROR ' + JSON.stringify(describe(error)));
    throw error;
  }
};
