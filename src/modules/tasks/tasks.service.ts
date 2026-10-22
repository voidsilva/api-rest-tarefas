import { randomUUID } from 'node:crypto';
import { notFound } from '../../shared/errors.ts';

export type Task = { id: string; ownerId: string; title: string; description?: string; done: boolean; createdAt: string; updatedAt: string };
export type TaskInput = { title: string; description?: string; done?: boolean };

export type ListQuery = { page: number; limit: number; done?: boolean; search?: string };

export class TasksService {
  private tasks = new Map<string, Task>();

  list(ownerId: string, q: ListQuery) {
    let items = [...this.tasks.values()].filter((t) => t.ownerId === ownerId);
    if (q.done !== undefined) items = items.filter((t) => t.done === q.done);
    if (q.search) {
      const s = q.search.toLowerCase();
      items = items.filter((t) => t.title.toLowerCase().includes(s));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = items.length;
    const start = (q.page - 1) * q.limit;
    return { data: items.slice(start, start + q.limit), meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
  }

  get(ownerId: string, id: string): Task {
    const task = this.tasks.get(id);
    // Tarefa de outro usuário retorna 404 (não vaza existência)
    if (!task || task.ownerId !== ownerId) throw notFound('Tarefa não encontrada');
    return task;
  }

  create(ownerId: string, input: TaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = { id: randomUUID(), ownerId, title: input.title, description: input.description, done: input.done ?? false, createdAt: now, updatedAt: now };
    this.tasks.set(task.id, task);
    return task;
  }

  update(ownerId: string, id: string, input: Partial<TaskInput>): Task {
    const task = this.get(ownerId, id);
    Object.assign(task, input, { updatedAt: new Date().toISOString() });
    return task;
  }

  remove(ownerId: string, id: string): void {
    this.get(ownerId, id);
    this.tasks.delete(id);
  }
}
