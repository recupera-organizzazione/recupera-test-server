import express from 'express';
import { pool } from './db.js';
import { gestisciErrori, ApiError } from './errors.js';
import { authRouter } from './routes/auth.js';
import { catalogoRouter } from './routes/catalogo.js';
import { prenotazioniRouter } from './routes/prenotazioni.js';
import { testRouter } from './routes/test.js';

export const app = express();
app.use(express.json());

app.get('/api/v1/health', async (req, res) => {
  await pool.query('select 1');
  res.json({ ok: true });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/catalogo', catalogoRouter);
app.use('/api/v1/prenotazioni', prenotazioniRouter);
app.use('/api/v1/test', testRouter);

app.use((req, res) => {
  throw new ApiError(404, 'non_trovato', `${req.method} ${req.path} non esiste`);
});
app.use(gestisciErrori);
