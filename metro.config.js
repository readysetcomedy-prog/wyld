const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js does an optional `@opentelemetry/api` import for
// tracing. That package isn't installed (and isn't needed here), but Metro
// resolves imports eagerly and fails the whole bundle when it can't find it.
// Stub it to an empty module so the optional tracing code just no-ops.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@opentelemetry/api') {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
