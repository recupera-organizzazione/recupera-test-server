# AGENTS.md — Guida operativa per agenti (recupera-test-server)

Questo file è l'unica fonte di istruzioni per agenti e contributori su questo repo. `CLAUDE.md` e `GEMINI.md` rimandano qui. Scopo, architettura, API e dati sono descritti in `README.md`: leggilo prima di ogni task.

## 0. Prima di qualsiasi cosa: `git pull`

Altri team lavorano sugli stessi repo. **Prima di leggere, modificare o eseguire qualunque cosa**, aggiorna il repo:

```bash
git pull --ff-only
```

- Se il pull fallisce (modifiche locali o storie divergenti), fermati e chiedi all'utente: non usare `reset`, `stash` o `push --force` di tua iniziativa.
- Ripeti il pull prima di ogni commit/push, così lavori sempre sull'ultima versione.

## 1. Contesto e stato reale

- Finto sistema CUP: login admin (stessi account della dashboard in `public.admin_users`, nessuna registrazione), prenotazioni fittizie fino al 31/12/2028, disdetta casuale compatibile con prenotazioni reali di Prenota.
- Server Node.js 22 + Express 5 in `src/`, accesso diretto a Postgres con `pg` (`DATABASE_URL`), validazione `zod`, JWT per gli admin.
- Database: progetto Supabase `recupera` (ref `jjkxvbjwruobclgwhtdt`), **condiviso con il team Prenota**.

## 2. Confini con il team Prenota (obbligatori)

- Le tabelle `public.*` (`slots`, `appointments`, `waiting_list`, `cancellation_events`, `notifications`) e le funzioni `public.book_available_slot` / `public.cancel_appointment_and_reallocate` **sono del team Prenota**. Non modificarne struttura, vincoli o funzioni senza accordo esplicito: puoi solo leggere, inserire dati di test e aggiungere indici.
- Tutto ciò che è del test-server sta nello schema `test_server`, che non va esposto dall'API Supabase (niente `grant` ad `anon`/`authenticated`).
- Le disdette passano sempre da `public.cancel_appointment_and_reallocate`, così si testa la logica vera di Prenota.
- Mai toccare utenti e prenotazioni **reali** (utenti `auth.users` non presenti in `test_server.pazienti_fittizi`). `supabase/seed/reset.sql` deve continuare a cancellare solo i dati fittizi.

## 3. Regole sui dati

- Solo dati inventati per i pazienti; i pazienti fittizi non hanno password e usano email `@paziente.recupera.test`.
- Catalogo: ASL e prestazioni dal dataset "Monitoraggio dei tempi di attesa", ospedali reali pugliesi. **Formato dei record di Prenota** (che confronta i testi esatti): `specialty_id` = branca come la scrive un paziente (`cardiologia`, colonna `test_server.prestazioni.branca`), `facility_id` = `"Nome - Comune"` (= `test_server.strutture.id`), `professional_id` = nome del medico (= `test_server.medici.id`, unico). La prestazione esatta del dataset (ID_PRESTAZIONE) si ricava da struttura + medico in `test_server.offerta`: non usare `specialty_id` per calibrare sul dataset. Non inventare nuove fonti: se aggiungi dati reali, documenta la fonte nel README.
- **Volumi legati al dataset** (`test_server.monitoraggio`, vista sui dati sincronizzati da dati.puglia.it, settimana `parametri.settimana_dataset` = 07-11 ottobre 2024): prenotazioni settimanali generate = dataset / `parametri.scala` per ASL e prestazione. Dopo ogni rigenerazione verifica `test_server.confronto_dataset` (scarto atteso entro ±1% per ASL). Non introdurre volumi o riempimenti inventati che non derivino dal dataset.
- `*_TMAX` è interpretato come "garantite entro il tempo massimo" (vedi README). Se il team cambia interpretazione, va cambiata solo la vista `test_server.pressione` e poi rigenerati seed 03 e 04.
- Orari: genera date con `timestamp` (non `timestamptz`) e converti con `at time zone 'Europe/Rome'`, altrimenti gli slot slittano di ore.
- `random()` in un `WHERE` che usa solo colonne di una tabella piccola (es. `random() < o.prob_prenotazione`) viene valutato una volta per riga di quella tabella: calcolalo in una CTE `materialized` e filtra dopo.
- Ogni modifica allo schema = nuovo file in `supabase/migrations/`, poi applicato al progetto; mai modifiche solo dalla dashboard Supabase.

## 4. Regole di lavoro

1. **Segreti:** mai committare `.env`, password del database o chiavi Supabase; versiona solo `.env.example`. Gli admin sono condivisi con la dashboard (`public.admin_users`, hash scrypt): non scrivere password in repo, README o seed.
2. **Verifica prima di dire "fatto":** `npm run dev`, `curl` sugli endpoint toccati (login, `/prenotazioni`, `/test/disdici-casuale`) e una prova dal frontend su <http://localhost:3001>; per l'SQL una prova in transazione annullata. Riporta comandi e output.
3. **API:** errori `{ error: { code, message } }`, input validato con `zod`, endpoint admin protetti da `soloAdmin`. Aggiorna la tabella API nel README quando aggiungi o cambi endpoint.
4. **Stack:** allineato a `recupera-dashboard/AGENTS.md` (Node 22, Supabase, niente Postgres locale in Docker). Altre scelte richiedono approvazione dell'utente.
5. **Git:** modifica i file, ma `commit`/`push`/PR solo su richiesta esplicita dell'utente.
