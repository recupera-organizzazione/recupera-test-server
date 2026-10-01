# AGENTS.md — Guida operativa per agenti (recupera-test-server)

Questo file è l'unica fonte di istruzioni per agenti e contributori su questo repo. `CLAUDE.md` e `GEMINI.md` rimandano qui. Scopo, architettura, API e dati sono descritti in `README.md`: leggilo prima di ogni task.

## 1. Contesto e stato reale

- Finto sistema CUP: login admin (solo account creati nel DB, nessuna registrazione), prenotazioni fittizie fino al 31/12/2028, disdetta casuale compatibile con prenotazioni reali di Prenota.
- Server Node.js 22 + Express 5 in `src/`, accesso diretto a Postgres con `pg` (`DATABASE_URL`), validazione `zod`, JWT per gli admin.
- Database: progetto Supabase `recupera` (ref `jjkxvbjwruobclgwhtdt`), **condiviso con il team Prenota**.

## 2. Confini con il team Prenota (obbligatori)

- Le tabelle `public.*` (`slots`, `appointments`, `waiting_list`, `cancellation_events`, `notifications`) e le funzioni `public.book_available_slot` / `public.cancel_appointment_and_reallocate` **sono del team Prenota**. Non modificarne struttura, vincoli o funzioni senza accordo esplicito: puoi solo leggere, inserire dati di test e aggiungere indici.
- Tutto ciò che è del test-server sta nello schema `test_server`, che non va esposto dall'API Supabase (niente `grant` ad `anon`/`authenticated`).
- Le disdette passano sempre da `public.cancel_appointment_and_reallocate`, così si testa la logica vera di Prenota.
- Mai toccare utenti e prenotazioni **reali** (utenti `auth.users` non presenti in `test_server.pazienti_fittizi`). `supabase/seed/reset.sql` deve continuare a cancellare solo i dati fittizi.

## 3. Regole sui dati

- Solo dati inventati per i pazienti; i pazienti fittizi non hanno password e usano email `@paziente.recupera.test`.
- Catalogo: ASL e prestazioni dal dataset "Monitoraggio dei tempi di attesa" (ID_PRESTAZIONE come `specialty_id`), ospedali reali pugliesi come `facility_id`. Non inventare nuove fonti: se aggiungi dati reali, documenta la fonte nel README.
- Orari: genera date con `timestamp` (non `timestamptz`) e converti con `at time zone 'Europe/Rome'`, altrimenti gli slot slittano di ore.
- Ogni modifica allo schema = nuovo file in `supabase/migrations/`, poi applicato al progetto; mai modifiche solo dalla dashboard Supabase.

## 4. Regole di lavoro

1. **Segreti:** mai committare `.env`, password del database o chiavi Supabase; versiona solo `.env.example`. La password admin di test `recuperapw` è volutamente nota: non riusarla per account veri.
2. **Verifica prima di dire "fatto":** `npm run dev`, `curl` sugli endpoint toccati (login, `/prenotazioni`, `/test/disdici-casuale`), e per l'SQL una prova in transazione annullata. Riporta comandi e output.
3. **API:** errori `{ error: { code, message } }`, input validato con `zod`, endpoint admin protetti da `soloAdmin`. Aggiorna la tabella API nel README quando aggiungi o cambi endpoint.
4. **Stack:** allineato a `recupera-dashboard/AGENTS.md` (Node 22, Supabase, niente Postgres locale in Docker). Altre scelte richiedono approvazione dell'utente.
5. **Git:** modifica i file, ma `commit`/`push`/PR solo su richiesta esplicita dell'utente.
