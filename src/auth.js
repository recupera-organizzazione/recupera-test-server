import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { ApiError } from './errors.js';

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
