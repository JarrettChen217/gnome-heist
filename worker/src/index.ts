// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T11a).
// Routes POST /session/{id}/morning to that session's Durable Object; everything else is the client.
export { FarmerSession } from './session.ts';

const SESSION_ROUTE = /^\/session\/([A-Za-z0-9_-]{8,64})\/morning$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const m = SESSION_ROUTE.exec(url.pathname);
    if (m !== null) {
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
      const stub = env.FARMER_SESSION.get(env.FARMER_SESSION.idFromName(m[1]!));
      return stub.fetch(request);
    }
    if (url.pathname.startsWith('/session/')) return new Response('Not Found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
