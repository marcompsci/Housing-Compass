/**
 * Wrap a handler with structured JSON logs (one line per request): function, request id,
 * status, duration. No request bodies, emails, tokens or locations are ever logged.
 */
export function observed(name: string, handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const started = performance.now();
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    let status = 500;
    try {
      const res = await handler(req);
      status = res.status;
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (e) {
      console.error(JSON.stringify({ level: "error", fn: name, requestId, error: (e as Error).message?.slice(0, 300) }));
      return new Response(JSON.stringify({ error: "internal error", requestId }), { status: 500, headers: { "content-type": "application/json" } });
    } finally {
      console.log(JSON.stringify({ level: "info", fn: name, requestId, method: req.method, status, ms: Math.round(performance.now() - started) }));
    }
  };
}
