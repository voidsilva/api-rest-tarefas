import { createServer } from 'node:http';
import { Router, type Ctx } from './http/router.ts';
import { AuthService } from './modules/auth/auth.service.ts';
import { verifyToken } from './modules/auth/jwt.ts';
import { TasksService, type TaskInput } from './modules/tasks/tasks.service.ts';
import { badRequest, unauthorized } from './shared/errors.ts';
import { validate, type Schema } from './shared/validate.ts';

const registerSchema: Schema = {
  name: { type: 'string', required: true, min: 2, max: 80 },
  email: { type: 'string', required: true, email: true },
  password: { type: 'string', required: true, min: 8, max: 72 },
};
const loginSchema: Schema = {
  email: { type: 'string', required: true },
  password: { type: 'string', required: true },
};
const taskSchema: Schema = {
  title: { type: 'string', required: true, min: 1, max: 120 },
  description: { type: 'string', max: 1000 },
  done: { type: 'boolean' },
};

export function buildApp(secret: string) {
  const auth = new AuthService(secret);
  const tasks = new TasksService();

  const requireAuth = (ctx: Ctx) => {
    const header = ctx.req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();
    ctx.userId = verifyToken(token, secret).sub;
  };

  const intParam = (raw: string | null, def: number, max: number) => {
    if (raw === null) return def;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > max) throw badRequest(`Parâmetro inválido: ${raw}`);
    return n;
  };

  const router = new Router()
    .on('GET', '/health', () => ({ body: { status: 'ok', uptime: process.uptime() } }))

    .on('POST', '/auth/register', ({ body }) => {
      const { name, email, password } = validate<{ name: string; email: string; password: string }>(body, registerSchema);
      return { status: 201, body: auth.register(name, email, password) };
    })
    .on('POST', '/auth/login', ({ body }) => {
      const { email, password } = validate<{ email: string; password: string }>(body, loginSchema);
      return { body: auth.login(email, password) };
    })

    .on('GET', '/tasks', requireAuth, ({ userId, query }) => {
      const done = query.get('done');
      return {
        body: tasks.list(userId!, {
          page: intParam(query.get('page'), 1, 10_000),
          limit: intParam(query.get('limit'), 10, 100),
          done: done === null ? undefined : done === 'true',
          search: query.get('search') ?? undefined,
        }),
      };
    })
    .on('GET', '/tasks/:id', requireAuth, ({ userId, params }) => ({ body: tasks.get(userId!, params.id) }))
    .on('POST', '/tasks', requireAuth, ({ userId, body }) => ({
      status: 201,
      body: tasks.create(userId!, validate<TaskInput>(body, taskSchema)),
    }))
    .on('PATCH', '/tasks/:id', requireAuth, ({ userId, params, body }) => ({
      body: tasks.update(userId!, params.id, validate<Partial<TaskInput>>(body, taskSchema, true)),
    }))
    .on('DELETE', '/tasks/:id', requireAuth, ({ userId, params }) => {
      tasks.remove(userId!, params.id);
      return { status: 204 };
    });

  return createServer(router.handle);
}
