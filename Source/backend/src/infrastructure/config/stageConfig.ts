// Stage-scopes a /wobblio/config/<key> SSM path to /wobblio/config/<stage>/<key> when the
// CONFIG_STAGE env var is set (CDK sets it per Lambda). When unset — unit tests and any
// flat-path caller — the path is returned unchanged, so the legacy flat layout still works.
// This is the single point that maps the code's logical config paths to the per-stage
// parameters created by WobblioConfigStack; both the runtime readers and the admin SSM
// writer go through it so they always agree on the physical path.
const CONFIG_STAGE = process.env.CONFIG_STAGE;
const CONFIG_ROOT = '/wobblio/config/';

export function stageScopeConfig(path: string): string {
  if (!CONFIG_STAGE || !path.startsWith(CONFIG_ROOT)) return path;
  return `${CONFIG_ROOT}${CONFIG_STAGE}/${path.slice(CONFIG_ROOT.length)}`;
}
