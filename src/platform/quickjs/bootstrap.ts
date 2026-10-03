/**
 * Sandbox runtime script — evaluated as a GLOBAL script inside the QuickJS
 * context BEFORE the extension module is imported.
 *
 * This is the QuickJS twin of the web's iframe bootstrap
 * (`pixiWeb/src/extensions/runtime/bootstrap.ts`): same isolation layers,
 * same `context` shape, same error codes and messages — only the transport
 * to the host differs (a native RPC instead of postMessage).
 *
 * Layer order, strongest first:
 *  1. the extension runs in its own JSRuntime — no DOM, no storage, no
 *     shared state with the app, and no host object ever escapes;
 *  2. every network primitive is pinned to `undefined` before module eval;
 *  3. URL/URLSearchParams are injected (QuickJS ships neither);
 *  4. all I/O goes through `context.http` → host policy layer, which owns
 *     timeouts, header policy and response limits.
 *
 * The extension source is delivered to the engine by the module loader, so
 * arbitrary extension text is never interpolated into this script.
 *
 * NOTE: keep this file free of backticks and `${` — it is one template literal.
 */
export const SANDBOX_BOOTSTRAP = `(function () {
  'use strict';

  var outcomes = new Map();
  var pendingHttp = new Map();
  var ext = null;
  var seq = 0;
  var boot = null;
  var EXT_ID = typeof __pixiExtId === 'string' && __pixiExtId ? __pixiExtId : 'extension';
  var LOCALE = typeof __pixiLocale === 'string' && __pixiLocale ? __pixiLocale : 'en';

  /* ---------------------------------------------------------------- */
  /* Layer: no network primitive exists in QuickJS — pin them anyway.   */
  /* ---------------------------------------------------------------- */
  var DENY = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'RTCPeerConnection',
              'Worker', 'SharedWorker', 'importScripts'];
  for (var di = 0; di < DENY.length; di++) {
    try {
      Object.defineProperty(globalThis, DENY[di], { value: undefined, writable: false, configurable: false });
    } catch (e) {}
  }
  try {
    Object.defineProperty(globalThis, 'window', { value: globalThis, writable: false, configurable: false });
  } catch (e) {}
  try {
    Object.defineProperty(globalThis, 'open', { value: undefined, writable: false, configurable: false });
  } catch (e) {}
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        language: LOCALE,
        languages: [LOCALE],
        userAgent: 'PixiMobile/1.0',
        sendBeacon: function sendBeacon() { return false; },
        serviceWorker: undefined
      },
      writable: false,
      configurable: false
    });
  } catch (e) {}

  /* ---------------------------------------------------------------- */
  /* console → host log                                                 */
  /* ---------------------------------------------------------------- */
  function format(value) {
    if (typeof value === 'string') return value;
    try {
      var json = JSON.stringify(value);
      if (typeof json === 'string') return json;
    } catch (e) {}
    try { return String(value); } catch (e) { return '[unprintable]'; }
  }

  function emit(level, args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) parts.push(format(args[i]));
    try { __pixiHostLog(level, parts.join(' ')); } catch (e) {}
  }

  var console = {
    debug: function () { emit('debug', arguments); },
    info: function () { emit('info', arguments); },
    log: function () { emit('log', arguments); },
    warn: function () { emit('warn', arguments); },
    error: function () { emit('error', arguments); }
  };
  try { Object.defineProperty(globalThis, 'console', { value: console, writable: true, configurable: true }); }
  catch (e) { globalThis.console = console; }

  function extErr(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  function logger(level) {
    return function () { emit(level, arguments); };
  }

  /* ---------------------------------------------------------------- */
  /* context.http — the only network path out of the sandbox            */
  /* ---------------------------------------------------------------- */
  function httpRequest(opts) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pendingHttp.set(id, { resolve: resolve, reject: reject });
      try {
        __pixiHostRequest(id, JSON.stringify({
          url: String(opts.url),
          method: String(opts.method || 'GET').toUpperCase(),
          headers: opts.headers || null,
          query: opts.query || null,
          body: opts.body === undefined ? null : opts.body,
          contentType: opts.contentType || null,
          timeoutMs: typeof opts.timeoutMs === 'number' && isFinite(opts.timeoutMs) ? opts.timeoutMs : null
        }));
      } catch (e) {
        pendingHttp.delete(id);
        reject(extErr('HTTP_ERROR', 'The request could not be sent.'));
      }
    });
  }

  var context = {
    http: {
      get: function (url, options) {
        return httpRequest(Object.assign({}, options, { url: url, method: 'GET' }));
      },
      post: function (url, body, options) {
        return httpRequest(Object.assign({}, options, {
          url: url,
          method: 'POST',
          body: body === undefined ? null : body
        }));
      },
      request: function (options) { return httpRequest(options); }
    },
    logger: { debug: logger('debug'), info: logger('info'), warn: logger('warn'), error: logger('error') },
    utils: {
      sleep: function (ms) {
        return new Promise(function (resolve) {
          setTimeout(resolve, Math.max(0, Math.min(Number(ms) || 0, 60000)));
        });
      },
      withQuery: function (url, query) {
        try {
          var u = new URL(String(url));
          if (query) {
            for (var key in query) {
              var value = query[key];
              if (value !== undefined && value !== null && typeof value !== 'object') {
                u.searchParams.set(key, String(value));
              }
            }
          }
          return u.toString();
        } catch (e) { return String(url); }
      }
    }
  };

  /* ---------------------------------------------------------------- */
  /* Host entry points                                                  */
  /* ---------------------------------------------------------------- */

  globalThis.__pixiBoot = function (mod) {
    if (boot !== null) return;
    var candidate = mod && mod.default ? mod.default : mod;
    if (!candidate || typeof candidate !== 'object' || !candidate.manifest ||
        typeof candidate.manifest !== 'object') {
      boot = JSON.stringify({ ok: false, err: {
        code: 'VALIDATION_FAILED',
        message: 'The extension does not export a manifest.'
      }});
      return;
    }
    var methods = {
      getSources: typeof candidate.getSources === 'function',
      getSubtitles: typeof candidate.getSubtitles === 'function'
    };
    try {
      boot = JSON.stringify({ ok: true, manifest: candidate.manifest, methods: methods });
    } catch (e) {
      boot = JSON.stringify({ ok: false, err: {
        code: 'VALIDATION_FAILED',
        message: 'The extension manifest contains unusable data.'
      }});
      return;
    }
    ext = candidate;
  };

  globalThis.__pixiTakeBoot = function () {
    if (boot === null) return undefined;
    var value = boot;
    boot = null;
    return value;
  };

  function invalidResult() {
    return JSON.stringify({ ok: false, err: {
      code: 'INVALID_RESULT',
      message: 'The extension returned data that cannot be used.'
    }});
  }

  globalThis.__pixiCall = function (opId, method, argsJson) {
    var args;
    try {
      args = JSON.parse(argsJson);
    } catch (e) {
      outcomes.set(opId, JSON.stringify({ ok: false, err: {
        code: 'EXTENSION_ERROR',
        message: 'The request could not be read.'
      }}));
      return;
    }

    var name = method === 'getSubtitles' ? 'getSubtitles' : 'getSources';
    var fn = ext && ext[name];
    if (typeof fn !== 'function') {
      outcomes.set(opId, JSON.stringify({ ok: false, err: {
        code: 'EXTENSION_ERROR',
        message: 'This extension does not implement ' + name + '().'
      }}));
      return;
    }

    Promise.resolve()
      .then(function () { return fn(context, args); })
      .then(
        function (value) {
          var json = null;
          try { json = JSON.stringify({ ok: true, value: value }); } catch (e) { json = null; }
          outcomes.set(opId, typeof json === 'string' ? json : invalidResult());
        },
        function (err) {
          var raw = err && err.message ? String(err.message).trim().slice(0, 300) : '';
          var code = err && typeof err.code === 'string' ? err.code : 'EXTENSION_ERROR';
          outcomes.set(opId, JSON.stringify({ ok: false, err: {
            code: code,
            message: raw || 'The extension failed while processing the request.'
          }}));
        }
      );
  };

  globalThis.__pixiTakeOutcome = function (opId) {
    if (!outcomes.has(opId)) return undefined;
    var value = outcomes.get(opId);
    outcomes.delete(opId);
    return value;
  };

  globalThis.__pixiHttpResult = function (requestId, ok, payloadJson) {
    var entry = pendingHttp.get(requestId);
    if (!entry) return;
    pendingHttp.delete(requestId);

    if (!ok) {
      var failure = null;
      try { failure = JSON.parse(payloadJson); } catch (e) { failure = null; }
      var code = failure && typeof failure.code === 'string' ? failure.code : 'HTTP_ERROR';
      var message = failure && failure.message ? String(failure.message) : 'Request failed.';
      entry.reject(extErr(code, message));
      return;
    }

    var response = null;
    try { response = JSON.parse(payloadJson); } catch (e) { response = null; }
    response = response || { status: 0, headers: {}, text: '' };
    entry.resolve({
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      headers: response.headers || {},
      text: response.text || '',
      json: function json() {
        try { return JSON.parse(response.text || ''); }
        catch (e) { throw extErr('EXTENSION_ERROR', 'The response is not valid JSON.'); }
      }
    });
  };

  /* ---------------------------------------------------------------- */
  /* Timers (backed by native host functions)                           */
  /* ---------------------------------------------------------------- */
  globalThis.setTimeout = function (fn, ms) {
    var delay = Math.max(0, Math.min(Number(ms) || 0, 60000));
    return __pixiSetTimeout(typeof fn === 'function' ? fn : function () {}, delay);
  };
  globalThis.clearTimeout = function (id) { return __pixiClearTimer(id); };
  globalThis.setInterval = function (fn, ms) {
    var delay = Math.max(1, Math.min(Number(ms) || 1, 60000));
    return __pixiSetInterval(typeof fn === 'function' ? fn : function () {}, delay);
  };
  globalThis.clearInterval = function (id) { return __pixiClearTimer(id); };
})();
`;

/**
 * The module entry — evaluated as an ES module AFTER {@link SANDBOX_BOOTSTRAP}.
 * Imports the extension through the engine's module loader and hands its
 * namespace to the bootstrap, mirroring the web's dynamic `import(blobUrl)`.
 */
export const SANDBOX_ENTRY =
  "import * as pixiModule from 'pixi:extension';\n" +
  'globalThis.__pixiBoot(pixiModule);\n';

/** The synthetic specifier the engine serves the extension source under. */
export const SANDBOX_MODULE_SPECIFIER = 'pixi:extension';
