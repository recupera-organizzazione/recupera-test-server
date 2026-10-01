import 'dotenv/config';

function richiesta(nome) {
  const valore = process.env[nome];
  if (!valore) {
    throw new Error(`Variabile d'ambiente mancante: ${nome} (vedi .env.example)`);
  }
  return valore;
}

export const config = {
  databaseUrl: richiesta('DATABASE_URL'),
  jwtSecret: richiesta('JWT_SECRET'),
  jwtScadenza: '8h',
  port: Number(process.env.PORT ?? 3001),
};
