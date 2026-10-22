export class AppError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, details);
export const unauthorized = (msg = 'Não autenticado') => new AppError(401, msg);
export const notFound = (msg = 'Recurso não encontrado') => new AppError(404, msg);
export const conflict = (msg: string) => new AppError(409, msg);
