import { badRequest } from './errors.ts';

type Rule = { type: 'string' | 'boolean'; required?: boolean; min?: number; max?: number; email?: boolean };
export type Schema = Record<string, Rule>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida um body contra um schema simples e retorna apenas os campos conhecidos. */
export function validate<T>(body: unknown, schema: Schema, partial = false): T {
  if (typeof body !== 'object' || body === null) throw badRequest('Body deve ser um objeto JSON');
  const input = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const [field, rule] of Object.entries(schema)) {
    const value = input[field];
    if (value === undefined) {
      if (rule.required && !partial) errors[field] = 'obrigatório';
      continue;
    }
    if (typeof value !== rule.type) { errors[field] = `deve ser ${rule.type}`; continue; }
    if (typeof value === 'string') {
      const v = value.trim();
      if (rule.min && v.length < rule.min) { errors[field] = `mínimo de ${rule.min} caracteres`; continue; }
      if (rule.max && v.length > rule.max) { errors[field] = `máximo de ${rule.max} caracteres`; continue; }
      if (rule.email && !EMAIL.test(v)) { errors[field] = 'e-mail inválido'; continue; }
      out[field] = v;
    } else {
      out[field] = value;
    }
  }

  if (Object.keys(errors).length) throw badRequest('Dados inválidos', errors);
  return out as T;
}
