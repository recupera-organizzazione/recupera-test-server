import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { firmaToken, soloAdmin, verificaPassword } from '../auth.js';
import { ApiError, validazione } from '../errors.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

// Solo login: gli admin esistono solo se creati nel DB (nessuna registrazione).
// Le credenziali sono quelle della dashboard (public.admin_users); test_server.admin_users resta
// come anagrafica locale, creata al primo accesso, per collegare le disdette all'admin.
authRouter.post('/login', async (req, res) => {
  const { username, password } = validazione(loginSchema, req.body ?? {});
  const { rows } = await pool.query(
    'select username, password_hash from public.admin_users where username = $1',
    [username],
  );
  if (rows.length === 0 || !verificaPassword(password, rows[0].password_hash)) {
    throw new ApiError(401, 'credenziali_errate', 'Username o password errati');
  }
  const { rows: [admin] } = await pool.query(
    `insert into test_server.admin_users (username, password_hash)
     values ($1, 'credenziali in public.admin_users')
     on conflict (username) do update set password_hash = excluded.password_hash
     returning id, username`,
    [username],
  );
  res.json({ token: firmaToken(admin), admin });
});

authRouter.get('/me', soloAdmin, (req, res) => {
  res.json({ admin: req.admin });
});
