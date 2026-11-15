/*
 * prisma-dummy-engine.c
 *
 * Minimal N-API stub that satisfies Prisma Client's library-engine loader in
 * environments where the real query engine binary cannot be downloaded
 * (e.g. sandboxes that block binaries.prisma.sh).
 *
 * What it provides:
 *   - exports `QueryEngine`: a constructor whose instances expose the methods
 *     Prisma calls (connect, disconnect, query, startTransaction, ...). Each
 *     method returns a rejected Promise with an explanatory message, so any
 *     actual database query fails gracefully (HTTP 500) instead of crashing.
 *   - exports `version()`: returns a fake { commit, version } object so the
 *     client's synchronous `library.version()` call succeeds.
 *   - exports `debugPanic()`: no-op.
 *
 * The bot flow (create bot / play turn) never touches the database, so a
 * server started with this stub is fully functional for bot play. Only the
 * DB-backed endpoints (bot presets, game persistence) will error out.
 *
 * Build (macOS arm64):
 *   cc -dynamiclib -fPIC -I<node-include-dir> \
 *      -o libquery_engine-darwin-arm64.dylib.node prisma-dummy-engine.c
 *
 * Then run `prisma generate` with:
 *   PRISMA_QUERY_ENGINE_LIBRARY=<path to built file>
 *   PRISMA_SCHEMA_ENGINE_BINARY=<any existing file, e.g. an empty one>
 * so the CLI skips its download step and copies this stub into
 * node_modules/.prisma/client under the expected engine filename.
 */

#include <node_api.h>

/* Every stubbed engine method rejects with this message. */
static const char *STUB_ERROR =
    "Prisma query engine is a local stub: no database is available in this "
    "environment (the real Prisma engine binary could not be downloaded).";

/* Callback for all stubbed engine methods: return a rejected Promise. */
static napi_value reject_cb(napi_env env, napi_callback_info info) {
  (void)info;
  napi_deferred deferred = NULL;
  napi_value promise = NULL;
  if (napi_create_promise(env, &deferred, &promise) != napi_ok) {
    return NULL;
  }
  napi_value message = NULL, err = NULL;
  if (napi_create_string_utf8(env, STUB_ERROR, NAPI_AUTO_LENGTH, &message) ==
          napi_ok &&
      napi_create_error(env, NULL, message, &err) == napi_ok) {
    napi_reject_deferred(env, deferred, err);
  } else {
    /* Should never happen; reject with undefined rather than crash. */
    napi_reject_deferred(env, deferred, NULL);
  }
  return promise;
}

/* No-op callback (debugPanic). */
static napi_value noop_cb(napi_env env, napi_callback_info info) {
  (void)env;
  (void)info;
  return NULL;
}

/* Methods Prisma calls on the engine instance (see runtime/library.js). */
static const char *engine_methods[] = {
    "connect",         "disconnect",       "query",
    "startTransaction", "commitTransaction", "rollbackTransaction",
    "metrics"};

/*
 * QueryEngine constructor. Prisma invokes it as:
 *   new library.QueryEngine(config, loggerCallback, driverAdapter)
 * We attach rejecting stubs for every method Prisma may call and return
 * undefined so the freshly created `this` object is used.
 */
static napi_value query_engine_ctor(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value this_arg = NULL;
  if (napi_get_cb_info(env, info, &argc, NULL, &this_arg, NULL) != napi_ok ||
      this_arg == NULL) {
    return NULL;
  }
  /* Only decorate real objects (i.e. calls made with `new`). */
  napi_valuetype t = napi_undefined;
  if (napi_typeof(env, this_arg, &t) != napi_ok || t != napi_object) {
    return NULL;
  }
  for (size_t i = 0; i < sizeof(engine_methods) / sizeof(engine_methods[0]);
       i++) {
    napi_value fn = NULL;
    if (napi_create_function(env, engine_methods[i], NAPI_AUTO_LENGTH,
                             reject_cb, NULL, &fn) == napi_ok) {
      napi_set_named_property(env, this_arg, engine_methods[i], fn);
    }
  }
  return NULL; /* undefined -> JS uses `this` */
}

/* version() -> { commit, version }; called synchronously by the client. */
static napi_value version_cb(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value obj = NULL, s = NULL;
  if (napi_create_object(env, &obj) != napi_ok) {
    return NULL;
  }
  const char *commit = "0000000000000000000000000000000000000000";
  if (napi_create_string_utf8(env, commit, NAPI_AUTO_LENGTH, &s) == napi_ok) {
    napi_set_named_property(env, obj, "commit", s);
  }
  const char *ver = "5.22.0";
  if (napi_create_string_utf8(env, ver, NAPI_AUTO_LENGTH, &s) == napi_ok) {
    napi_set_named_property(env, obj, "version", s);
  }
  return obj;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value fn = NULL;
  if (napi_create_function(env, "QueryEngine", NAPI_AUTO_LENGTH,
                           query_engine_ctor, NULL, &fn) == napi_ok) {
    napi_set_named_property(env, exports, "QueryEngine", fn);
  }
  if (napi_create_function(env, "version", NAPI_AUTO_LENGTH, version_cb, NULL,
                           &fn) == napi_ok) {
    napi_set_named_property(env, exports, "version", fn);
  }
  if (napi_create_function(env, "debugPanic", NAPI_AUTO_LENGTH, noop_cb, NULL,
                           &fn) == napi_ok) {
    napi_set_named_property(env, exports, "debugPanic", fn);
  }
  return exports;
}

NAPI_MODULE(prisma_dummy_engine, init)
