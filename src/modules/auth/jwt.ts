import { createHmac, timingSafeEqual } from 'node:crypto';
import { unauthorized } from '../../shared/errors.ts';

export type JwtPayload = { sub: string; email: string; iat: number; exp: number };

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function sign(data: string, secret: string) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/** Gera um JWT HS256 (RFC 7519). */
export function signToken(sub: string, email: string, secret: string, ttlSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub, email, iat: now, exp: now + ttlSeconds }));
  return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`;
}

export function verifyToken(token: string, secret: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw unauthorized('Token malformado');
  const [header, payload, signature] = parts;

  const expected = Buffer.from(sign(`${header}.${payload}`, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw unauthorized('Assinatura inválida');
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as JwtPayload;
  if (data.exp < Math.floor(Date.now() / 1000)) throw unauthorized('Token expirado');
  return data;
}
