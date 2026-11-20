// Outgoing HTTP for the Gyro API and docs: one keep-alive connection pool per process, IPv4 first without happy-eyeballs,
// and a retry ONLY when the connection could not be opened (TCP/TLS handshake). Once a request was handed to a socket it is
// never repeated, so POST/PUT/DELETE can never run twice because of this layer.
import dns from 'node:dns';
import { Agent, buildConnector, fetch as undiciFetch } from 'undici';

export const NET = Object.freeze({
  connectTimeoutMs: 4000,   // TCP + TLS handshake budget per attempt (covers the kernel's SYN retries at 1 s and 3 s)
  connectAttempts: 3,       // total attempts, only for connect-phase failures
  keepAliveTimeoutMs: 60000,
  keepAliveMaxTimeoutMs: 120000,
  connections: 6,           // per origin
});

const CONNECT_PHASE = Symbol.for('gyro.mcp.connectPhase');

/** dns.lookup with IPv4 addresses first (our pods and many customer networks have no IPv6 route). */
export function lookupIpv4First(hostname, options, cb) {
  if (typeof options === 'function') { cb = options; options = {}; }
  return dns.lookup(hostname, { ...(typeof options === 'number' ? { family: options } : options), order: 'ipv4first', verbatim: false }, cb);
}

/** Wraps a connector so every error it reports is marked as "before the request was sent". */
export function markConnectErrors(connector) {
  return (opts, cb) => connector(opts, (err, socket) => {
    if (err && typeof err === 'object') { try { Object.defineProperty(err, CONNECT_PHASE, { value: true }); } catch { /* frozen */ } }
    cb(err, socket);
  });
}

export function createDispatcher(o = {}) {
  const c = { ...NET, ...o };
  const connector = buildConnector({ timeout: c.connectTimeoutMs, autoSelectFamily: false, lookup: lookupIpv4First });
  return new Agent({ connect: markConnectErrors(connector), keepAliveTimeout: c.keepAliveTimeoutMs,
    keepAliveMaxTimeout: c.keepAliveMaxTimeoutMs, connections: c.connections, pipelining: 1 });
}

function causeChain(e) {
  const out = []; let x = e;
  for (let i = 0; x && i < 5; i++) { out.push(x); if (Array.isArray(x.errors)) out.push(...x.errors); x = x.cause; }
  return out;
}

/** True only for failures that happened while opening the connection (nothing was sent to the server). */
export function isConnectError(e) {
  return causeChain(e).some((x) => x && typeof x === 'object' && (x[CONNECT_PHASE] === true || x.code === 'UND_ERR_CONNECT_TIMEOUT'));
}

export function errorCode(e) {
  const x = causeChain(e).find((y) => y && y.code);
  return x ? String(x.code) : (e && e.name) || 'error';
}

let netLog = null;
/** Optional logger for connect retries (HTTP mode logs them as JSON lines; nothing secret is passed). */
export function setNetLogger(fn) { netLog = typeof fn === 'function' ? fn : null; }

/**
 * fetch with connect-phase retries. fetchImpl/dispatcher are injectable for tests.
 * The body must be a string/Buffer (re-sendable) - the API client only sends JSON strings.
 */
export function makeFetch({ fetchImpl = undiciFetch, dispatcher, attempts = NET.connectAttempts, backoffMs = 150 } = {}) {
  let d = dispatcher;
  return async function gyroFetch(url, init = {}) {
    if (d === undefined) d = createDispatcher();
    for (let i = 1; ; i++) {
      try {
        return await fetchImpl(url, d ? { ...init, dispatcher: d } : init);
      } catch (e) {
        const aborted = init.signal && init.signal.aborted;
        if (aborted || !isConnectError(e)) throw e;
        const code = errorCode(e);
        let host = ''; try { host = new URL(String(url)).host; } catch { /* ignore */ }
        if (i >= attempts) {
          if (netLog) netLog({ net: 'connect_failed', host, attempts: i, code });
          throw new Error(`fetch failed: could not connect to ${host || 'the server'} after ${i} attempts (${code}); nothing was sent, it is safe to retry`, { cause: e });
        }
        if (netLog) netLog({ net: 'connect_retry', host, attempt: i, code });
        if (backoffMs) await new Promise((r) => setTimeout(r, backoffMs * i));
      }
    }
  };
}

/** Process-wide default: shared pool for the API and the docs. */
export const gyroFetch = makeFetch();
