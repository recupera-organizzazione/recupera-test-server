import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { firmaToken, soloAdmin } from '../auth.js';
import { ApiError, validazione } from '../errors.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

// Solo login: gli admin esistono solo se creati nel DB (nessuna registrazione).
authRouter.post('/login', async (req, res) => {
  const { username, password } = validazione(loginSchema, req.body ?? {});
  const { rows } = await pool.query(
    `select id, username from test_server.admin_users
     where username = $1 and password_hash = extensions.crypt($2, password_hash)`,
    [username, password],
  );
  if (rows.length === 0) {
    throw new ApiError(401, 'credenziali_errate', 'Username o password errati');
  }
  res.json({ token: firmaToken(rows[0]), admin: rows[0] });
});

authRouter.get('/me', soloAdmin, (req, res) => {
  res.json({ admin: req.admin });
});
