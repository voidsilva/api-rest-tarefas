import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppError, badRequest, notFound } from '../shared/errors.ts';

export type Ctx = {
  req: IncomingMessage;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  userId?: string;
};
export type Result = { status?: number; body?: unknown };
export type Handler = (ctx: Ctx) => Result | Promise<Result>;
export type Middleware = (ctx: Ctx) => void | Promise<void>;

type Route = { method: string; pattern: RegExp; keys: string[]; handlers: (Middleware | Handler)[] };

const MAX_BODY = 1_000_000; // 1 MB

export class Router {
  private routes: Route[] = [];

  on(method: string, path: string, ...handlers: (Middleware | Handler)[]) {
    const keys: string[] = [];
    const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ method, pattern, keys, handlers });
    return this;
  }

  handle = async (req: IncomingMessage, res: ServerResponse) => {
    const started = performance.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      const route = this.routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
      if (!route) throw notFound('Rota não encontrada');

      const match = url.pathname.match(route.pattern)!;
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
      const ctx: Ctx = { req, params, query: url.searchParams, body: await readJson(req) };

      let result: Result | void = undefined;
      for (const h of route.handlers) result = await h(ctx);
      send(res, (result as Result)?.status ?? 200, (result as Result)?.body);
    } catch (err) {
      if (err instanceof AppError) {
        send(res, err.status, { error: err.message, ...(err.details ? { details: err.details } : {}) });
      } else {
        console.error(err);
        send(res, 500, { error: 'Erro interno' });
      }
    } finally {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`${req.method} ${url.pathname} ${res.statusCode} ${(performance.now() - started).toFixed(1)}ms`);
      }
    }
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'DELETE') return undefined;
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new AppError(413, 'Payload muito grande');
    chunks.push(chunk);
  }
  if (!chunks.length) return undefined;
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw badRequest('JSON inválido'); }
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (body === undefined) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
