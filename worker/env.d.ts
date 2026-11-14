// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T11a).

declare namespace Cloudflare {
  interface Env {
    FARMER_SESSION: DurableObjectNamespace<import('./src/session.ts').FarmerSession>;
    ASSETS: Fetcher;
  }
}
interface Env extends Cloudflare.Env {}

/** Tiled maps are bundled as text (wrangler `rules`; a Vite plugin in the tests). */
declare module '*.tmj' {
  const text: string;
  export default text;
}
