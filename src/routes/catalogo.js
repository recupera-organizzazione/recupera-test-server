import { Router } from 'express';
import { pool } from '../db.js';

export const catalogoRouter = Router();

// Pubblico: nomi di ASL, prestazioni, strutture e medici per tradurre gli id usati in slots/appointments.
catalogoRouter.get('/', async (req, res) => {
  const [asl, prestazioni, strutture, offerta] = await Promise.all([
    pool.query('select id, sigla, nome from test_server.asl order by sigla'),
    pool.query('select id, codice, descrizione, durata_min from test_server.prestazioni order by descrizione'),
    pool.query('select id, asl_id, nome, comune from test_server.strutture order by id'),
    pool.query(
      `select o.struttura_id, o.prestazione_id, o.medico_id, m.nome as medico, o.slot_giornalieri
       from test_server.offerta o join test_server.medici m on m.id = o.medico_id
       order by o.struttura_id, o.prestazione_id`,
    ),
  ]);
  res.json({
    asl: asl.rows,
    prestazioni: prestazioni.rows,
    strutture: strutture.rows,
    offerta: offerta.rows,
  });
});
