# AGENTS.md — Guida operativa per agenti (recupera-test-server)

Questo file è l'unica fonte di istruzioni per agenti e contributori su questo repo. `CLAUDE.md` e `GEMINI.md` rimandano qui.

## 1. Contesto e stato reale

- Il repo contiene solo un `README.md` che non descrive il progetto: **non esiste ancora codice**.
- Lo scopo previsto è un server di test per il progetto reCUPera, ma non è documentato: non inventare requisiti, endpoint o stack. Chiedi all'utente prima di scaffoldare.

## 2. Regole di lavoro

1. **Stack:** se serve un server, allineati alle decisioni di `recupera-dashboard/AGENTS.md` (Node.js 22 + Express sopra Supabase, validazione `zod`, niente Postgres locale in Docker). Scelte diverse richiedono approvazione dell'utente.
2. **Segreti:** mai committare `.env`, chiavi Supabase (in particolare `service_role`) o dati personali reali; versiona solo `.env.example` senza valori.
3. **Verifica prima di affermare:** riporta comandi eseguiti e output (es. `curl` sugli endpoint) prima di dire che qualcosa funziona.
4. **Documentazione:** quando aggiungi codice, aggiorna `README.md` (scopo, avvio) e questo file (vincoli e comandi).
5. **Git:** modifica i file, ma `commit`/`push`/PR solo su richiesta esplicita dell'utente.
