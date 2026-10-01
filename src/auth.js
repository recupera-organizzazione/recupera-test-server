import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { ApiError } from './errors.js';

// Gli admin sono condivisi con la dashboard: tabella public.admin_users, hash scrypt nel formato
// `scrypt$N$r$p$sale_b64$hash_b64` (stesso di recupera-dashboard/backend/src/auth.js).
export function verificaPassword(password, salvata) {
  const [tag, n, r, p, sale, chiave] = String(salvata).split('$');
  if (tag !== 'scrypt' || !sale || !chiave) return false;
  const attesa = Buffer.from(chiave, 'base64');
  const calcolata = crypto.scryptSync(password, Buffer.from(sale, 'base64'), attesa.length, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  return crypto.timingSafeEqual(calcolata, attesa);
}

export function firmaToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username, ruolo: 'admin' }, config.jwtSecret, {
    expiresIn: config.jwtScadenza,
  });
}

// Middleware: richiede header "Authorization: Bearer <token>" di un admin.
export function soloAdmin(req, res, next) {
  const [schema, token] = (req.get('authorization') ?? '').split(' ');
  if (schema !== 'Bearer' || !token) {
    throw new ApiError(401, 'non_autenticato', 'Login richiesto');
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.admin = { id: payload.sub, username: payload.username };
  } catch {
    throw new ApiError(401, 'token_non_valido', 'Token non valido o scaduto');
  }
  next();
}
