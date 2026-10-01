# recupera-test-server

Finto sistema **CUP** per sviluppare e testare reCUPera senza il CUP reale: agenda di slot, prenotazioni fittizie fino al 2028, login admin e disdetta casuale di una prenotazione per provare il flusso di riassegnazione dell'app Prenota.

## Architettura

- **Database:** progetto Supabase `recupera` (condiviso con Prenota).
  - Tabelle `public.slots`, `public.appointments`, `public.waiting_list`, `public.cancellation_events`, `public.notifications` e funzioni `book_available_slot` / `cancel_appointment_and_reallocate`: create dal **team Prenota**, il test-server le popola e le usa senza cambiarne la struttura.
  - Schema `test_server` (non esposto dall'API Supabase): admin, catalogo, pazienti fittizi, log delle disdette, vista `prenotazioni`, funzione `disdici_casuale`.
- **Server:** Node.js 22 + Express 5, `pg` diretto al database, `zod` per la validazione, JWT per le sessioni admin.

### Prenotazioni loggate e fittizie

Ogni prenotazione (`public.appointments`) è legata a un utente `auth.users` tramite `patient_id`:

- **loggata**: utente reale che ha fatto login su Prenota e ha prenotato;
- **fittizia**: paziente generato dal seed (in `test_server.pazienti_fittizi`, email `@paziente.recupera.test`, senza password: non può fare login).

La vista `test_server.prenotazioni` le unisce con la colonna `tipo`.

## Dati generati

| Cosa | Quantità |
|---|---|
| Slot | ~160.000, dal 2 ottobre 2026 al 31 dicembre 2028 |
| Prenotazioni fittizie | ~82.600 (circa 67% degli slot nel 2026, 57% nel 2027, 42% nel 2028) |
| Pazienti fittizi | 2.500, ripartiti per ASL |
| Strutture | 12 (2 per ASL), 4 prestazioni ciascuna, 1 medico per prestazione |

Orari: dalle 08:30 (ora di Roma), lun-ven slot pieni, sabato metà, domenica e festivi nazionali chiusi. Ogni struttura ha una `quota_riempimento` diversa per avere centri pieni (es. San Paolo 92%) e vuoti (es. Camberlingo 45%); le prenotazioni si diradano andando avanti nel tempo.

### Fonti dei dati

- **Reali:** codici e nomi delle 6 ASL pugliesi e le 10 prestazioni più prenotate (ID, codice, descrizione) dal dataset "Monitoraggio dei tempi di attesa", settimana 07-11 ottobre 2024 (lo stesso di `recupera-dashboard`); nomi e comuni di 12 ospedali reali delle ASL pugliesi.
- **Inventati:** medici, pazienti, durate e numero di slot, quote di riempimento, orari.

## Avvio

```bash
cp .env.example .env   # inserisci DATABASE_URL (Supabase > Connect > Session pooler) e JWT_SECRET
npm install
npm run dev            # http://localhost:3001
```

Admin di test: **username `recupera`, password `recuperapw`**. Non c'è registrazione: altri admin si creano solo da SQL:

```sql
insert into test_server.admin_users (username, password_hash)
values ('nome', extensions.crypt('password', extensions.gen_salt('bf', 10)));
```

## API (`/api/v1`)

Errori sempre nel formato `{ "error": { "code", "message" } }`. 🔒 = richiede `Authorization: Bearer <token>`.

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/health` | stato server e database |
| POST | `/auth/login` | `{ username, password }` → `{ token, admin }` (token valido 8 ore) |
| GET | `/auth/me` 🔒 | admin del token |
| GET | `/catalogo` | ASL, prestazioni, strutture, medici e offerta, per tradurre gli id di slot e prenotazioni |
| GET | `/prenotazioni` 🔒 | filtri: `tipo` (`loggata`, `fittizia`, `tutte`), `stato` (`booked`, `cancelled`, `tutti`), `prestazione`, `struttura`, `paziente`, `da`, `a` (YYYY-MM-DD), `limit` (max 500), `offset` |
| POST | `/test/disdici-casuale` 🔒 | `{ target_id? }` disdice una prenotazione fittizia compatibile con una prenotazione reale (vedi sotto) |
| GET | `/test/disdette` 🔒 | ultime 50 disdette di test |

### Disdetta casuale compatibile

1. Sceglie un **target reale**: la prenotazione loggata indicata da `target_id`, oppure una a caso tra quelle future (oltre 2 giorni). Se non ce ne sono, usa una voce di lista d'attesa di un utente reale.
2. Cerca a caso una **prenotazione fittizia compatibile**: stessa prestazione, slot tra più di 24 ore e **prima** di quello del target, preferendo la stessa ASL (per la lista d'attesa rispetta strutture, medici e finestra di date richieste).
3. La disdice con `public.cancel_appointment_and_reallocate` (logica del team Prenota): lo slot torna libero o viene riassegnato dalla lista d'attesa.
4. Risponde con slot liberato, target e giorni di anticipo possibili; registra tutto in `test_server.disdette_test`.

Se non esistono prenotazioni reali o nessuna è compatibile risponde `404 nessuna_compatibile`.

```bash
TOKEN=$(curl -s localhost:3001/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"username":"recupera","password":"recuperapw"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s -X POST localhost:3001/api/v1/test/disdici-casuale -H "authorization: Bearer $TOKEN"
```

## Database: migrazioni e seed

- `supabase/migrations/20261001120000_test_server_schema.sql`: schema `test_server` (già applicato al progetto `recupera`).
- `supabase/seed/01_catalogo_admin_pazienti.sql`: admin, catalogo, pazienti fittizi.
- `supabase/seed/02_slot_prenotazioni.sql`: slot e prenotazioni, da eseguire un anno alla volta per il timeout di 2 minuti: `psql "$DATABASE_URL" -v anno=2027 -f supabase/seed/02_slot_prenotazioni.sql`.
- `supabase/seed/reset.sql`: cancella solo i dati fittizi (prenotazioni e utenti reali restano).
