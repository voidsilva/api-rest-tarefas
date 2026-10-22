import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/app.ts';

const server = buildApp('test-secret-with-at-least-32-characters!!');
let base = '';

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

async function createUserAndLogin(email: string) {
  await api('POST', '/auth/register', { name: 'Paulo', email, password: 'senhaforte123' });
  const { body } = await api('POST', '/auth/login', { email, password: 'senhaforte123' });
  return body.accessToken as string;
}

before(async () => {
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

describe('auth', () => {
  it('cadastra e faz login', async () => {
    const reg = await api('POST', '/auth/register', { name: 'Ana', email: 'ana@ex.com', password: 'senhaforte123' });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.passwordHash, undefined, 'não deve expor o hash');

    const login = await api('POST', '/auth/login', { email: 'ANA@ex.com', password: 'senhaforte123' });
    assert.equal(login.status, 200);
    assert.match(login.body.accessToken, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('rejeita e-mail duplicado', async () => {
    await api('POST', '/auth/register', { name: 'Bia', email: 'bia@ex.com', password: 'senhaforte123' });
    const dup = await api('POST', '/auth/register', { name: 'Bia', email: 'bia@ex.com', password: 'senhaforte123' });
    assert.equal(dup.status, 409);
  });

  it('valida campos', async () => {
    const res = await api('POST', '/auth/register', { name: 'X', email: 'invalido', password: '123' });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.details).sort(), ['email', 'name', 'password']);
  });

  it('senha errada retorna 401', async () => {
    await api('POST', '/auth/register', { name: 'Caio', email: 'caio@ex.com', password: 'senhaforte123' });
    const res = await api('POST', '/auth/login', { email: 'caio@ex.com', password: 'errada' });
    assert.equal(res.status, 401);
  });

  it('bloqueia rota protegida sem token ou com token adulterado', async () => {
    assert.equal((await api('GET', '/tasks')).status, 401);
    const token = await createUserAndLogin('dani@ex.com');
    assert.equal((await api('GET', '/tasks', undefined, token.slice(0, -2) + 'xx')).status, 401);
  });
});

describe('tasks', () => {
  it('CRUD completo', async () => {
    const token = await createUserAndLogin('crud@ex.com');

    const created = await api('POST', '/tasks', { title: 'Emitir NF' }, token);
    assert.equal(created.status, 201);
    assert.equal(created.body.done, false);

    const id = created.body.id;
    const updated = await api('PATCH', `/tasks/${id}`, { done: true }, token);
    assert.equal(updated.body.done, true);
    assert.equal(updated.body.title, 'Emitir NF');

    assert.equal((await api('GET', `/tasks/${id}`, undefined, token)).status, 200);
    assert.equal((await api('DELETE', `/tasks/${id}`, undefined, token)).status, 204);
    assert.equal((await api('GET', `/tasks/${id}`, undefined, token)).status, 404);
  });

  it('paginação, filtro e busca', async () => {
    const token = await createUserAndLogin('pag@ex.com');
    for (let i = 1; i <= 12; i++) await api('POST', '/tasks', { title: `Tarefa ${i}`, done: i % 2 === 0 }, token);

    const page2 = await api('GET', '/tasks?page=2&limit=5', undefined, token);
    assert.equal(page2.body.data.length, 5);
    assert.deepEqual(page2.body.meta, { page: 2, limit: 5, total: 12, totalPages: 3 });

    const done = await api('GET', '/tasks?done=true&limit=100', undefined, token);
    assert.equal(done.body.meta.total, 6);

    const search = await api('GET', '/tasks?search=tarefa 1', undefined, token);
    assert.equal(search.body.meta.total, 4); // 1, 10, 11, 12

    assert.equal((await api('GET', '/tasks?limit=500', undefined, token)).status, 400);
  });

  it('isola tarefas entre usuários', async () => {
    const a = await createUserAndLogin('a@ex.com');
    const b = await createUserAndLogin('b@ex.com');
    const task = await api('POST', '/tasks', { title: 'Privada' }, a);
    assert.equal((await api('GET', `/tasks/${task.body.id}`, undefined, b)).status, 404);
    assert.equal((await api('DELETE', `/tasks/${task.body.id}`, undefined, b)).status, 404);
  });

  it('JSON inválido e rota inexistente', async () => {
    const res = await fetch(base + '/auth/login', { method: 'POST', body: '{quebrado' });
    assert.equal(res.status, 400);
    assert.equal((await api('GET', '/nao-existe')).status, 404);
  });
});
