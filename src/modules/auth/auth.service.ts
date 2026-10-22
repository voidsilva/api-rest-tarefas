import { randomUUID } from 'node:crypto';
import { conflict, unauthorized } from '../../shared/errors.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { signToken } from './jwt.ts';

export type User = { id: string; name: string; email: string; passwordHash: string; createdAt: string };

export class AuthService {
  private users = new Map<string, User>(); // chave: email
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  register(name: string, email: string, password: string) {
    const key = email.toLowerCase();
    if (this.users.has(key)) throw conflict('E-mail já cadastrado');
    const user: User = { id: randomUUID(), name, email: key, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    this.users.set(key, user);
    return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  }

  login(email: string, password: string) {
    const user = this.users.get(email.toLowerCase());
    // Mesma mensagem nos dois casos para não revelar quais e-mails existem
    if (!user || !verifyPassword(password, user.passwordHash)) throw unauthorized('Credenciais inválidas');
    return { accessToken: signToken(user.id, user.email, this.secret), tokenType: 'Bearer', expiresIn: 3600 };
  }
}
