import { buildApp } from './app.ts';

const PORT = Number(process.env.PORT ?? 3000);
const SECRET = process.env.JWT_SECRET;

if (!SECRET || SECRET.length < 32) {
  console.error('JWT_SECRET precisa estar definido com pelo menos 32 caracteres.');
  process.exit(1);
}

const server = buildApp(SECRET).listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));

// Encerramento gracioso (Docker / Kubernetes enviam SIGTERM)
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
