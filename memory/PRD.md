# Family Task — PRD

## Aggiornamento giugno 2026 — Security audit
- SEC-001 (HIGH) risolto: il membro attivo è ora vincolato alla sessione server-side (`active_member_id` su `user_sessions`). L'header `X-Member-Id` non conferisce privilegi da solo (403 se non attivato).
- `POST /api/family/members/{id}/verify-pin` attiva il profilo sulla sessione; `POST /api/family/deactivate` lo rilascia (cambio utente); `DELETE /api/auth/session` revoca la sessione (logout).
- `POST /api/family/create` auto-attiva il capo; `GET /api/family` e `/api/auth/me` restituiscono `active_member_id`.
- Hardening: CORS `allow_credentials=False` (auth Bearer, non cookie), vincoli Pydantic di lunghezza/pattern su tutti gli input, `/api/register-push` ora autenticato.
- Scelta utente: NESSUN anti-brute-force sul PIN (rischio accettato).
- UI: scritta piccola «Miska (Developer)» su login e Profilo. Rimosso preset compito «Porta a spasso il cane».
- Test: `/app/test_reports/iteration_7.json` — 13/13 backend + regressione frontend OK.

## Problem statement (original, Italian)
App mobile per la famiglia: i membri sono utenti diversi; si assegnano compiti di casa (studia, pulisci, fai la lavatrice) preimpostati o personalizzati; calendario gestito dal capo famiglia con tutte le attività, dove i membri possono al massimo visualizzare o aggiungere i propri impegni.

## User choices
- Accesso attuale: creazione famiglia, ingresso con codice invito, profili nome/PIN. Pulsante Google rimosso il 2026-09-22 su richiesta esplicita: «Togli accedi con Google non serve». Sessioni e record già esistenti conservati.
- Creazione attività: il capo famiglia assegna + ogni membro può aggiungere i propri impegni.
- Gamification: sì, punti e classifica.
- Stile: personalizzabile per tutti e per singolo utente (colore accento per utente).
- Lingua: solo italiano.
- Nuova richiesta: «Deve diventare una webapp sia per Android che GoogleApple». Confermato: webapp mobile installabile dalla Home su Android, iPhone e iPad, senza store.

## Architecture
- Frontend: Expo Router (React Native), react-query, react-native-reanimated, phosphor-react-native, Fredoka/Nunito fonts, per-user accent theming.
- Backend: FastAPI + MongoDB (motor). Bearer session tokens (7gg) in `user_sessions`. RBAC via `X-Member-Id` header.
- Auth dual model: Google OAuth (Emergent) OR device family creation (name + optional PIN). Both mint a session for the family owner.
- Data: users, families, members (pin_hash, accent_color, role, points), activities (type compito|impegno, points, assigned_to, date, status), soft deletes via `deleted_at`.

## User personas
- Capo famiglia (genitore): assegna compiti, gestisce membri e calendario, vede tutti.
- Membro (figlio): vede i propri compiti, li completa, aggiunge propri impegni, personalizza il colore.

## Core requirements (static)
- Membri come profili con avatar + PIN, cambio utente su dispositivo condiviso.
- Compiti preimpostati e personalizzati assegnati dal capo.
- Calendario condiviso con selettore date; membri aggiungono solo impegni propri.
- Punti assegnati al completamento dei compiti; classifica con podio.
- Colore accento personalizzabile per singolo utente.

## Implemented (2026-06)
- Backend API: auth (Google + device family/create), invite code join/regenerate, members CRUD + verify-pin, activities CRUD + complete/uncomplete + single GET + recurring (dates[]) + end_time, commenti (chat), rewards CRUD (capo) + redeem + redemptions, leaderboard, presets, register-push. RBAC, soft delete, punti con rollback, notifiche push (assegnazione/chat/completamento/riscatto).
- Frontend: login (crea/Google/unisciti con codice), crea-famiglia (nota codice + colore custom), join-family, selezione membro con PIN, tab Oggi/Calendario/Classifica/Profilo, dettaglio task (/task/[id]) con nota + chat, Premi (/rewards) con riscatto e storico, impegni personali con colore distinto (slate) e orario inizio–fine, compiti ricorrenti (giorni + settimane), colore accento personalizzabile per utente (preset + ruota colore), codice invito visibile (copia/condividi/rigenera).
- Notifiche push: expo-notifications + register-push; funziona solo dopo deploy+build reale con google-services.json (in attesa dal cliente).
- Testing: iter1 (26) + iter2 + iter3 (20) backend + E2E frontend, tutti superati.

## Webapp mobile / PWA (2026-09-22)
- Conservati Expo Router / React Native e backend FastAPI/Mongo. Compatibilità browser mobile, manifest standalone e icone Family Task (192/512 e Apple 180), lingua italiana e safe area iOS.
- `public/index.html` è il template effettivo per Expo `web.output=single`; `app/+html.tsx` da solo NON viene usato in questa modalità. Non cambiare output o metro.config.js.
- `/install-app`: guida Android / iPhone-iPad, installazione nativa Chrome quando il browser offre l’evento, stato Home, link da login e profilo, impostazioni notifiche personali.
- Service worker `/sw.js`: registra senza chiedere permessi, conserva SOLO icone e pagina offline; nessuna cache API/sessioni/chat. Aggiornamenti su consenso, banner offline e nessuna coda di scritture offline.
- Web Push standard VAPID con `pywebpush`, indipendente da Firebase: config, sottoscrizione per dispositivo/profilo, stato, disattivazione, prova. Collegato a compiti/chat/completamenti/premi. Consenso richiesto solo al tap; iOS 16.4+ richiede Home. Disattivazione prima di cambio profilo/uscita.
- VAPID privato generato una volta e conservato in `app_config` Mongo (`webpush-vapid`), mai restituito dal server. `WEB_PUSH_SUBJECT` in backend .env è l’URI di contatto; aggiornare se cambia dominio. Sottoscrizioni in `web_push_subscriptions` con ID hash endpoint.
- API `/api/web-push/*`: riutilizzano Bearer famiglia + X-Member-Id (nessuna nuova autenticazione). Validazione endpoint HTTPS dei provider e chiavi, niente redirect esterni; pulizia 404/410, invio non bloccante.
- Invito condiviso dal web include URL corrente e codice; copia di riserva se Web Share non disponibile.
- URL backend via `Constants.expoConfig.extra.backendUrl` con fallback statico a `process.env.EXPO_PUBLIC_BACKEND_URL` (indispensabile su Expo single web dove extra può non essere disponibile). Validazione HTTP(S) impedisce richieste /undefined/api.
- Icona sorgente conservata in managed storage: https://static.prod-images.emergentagent.com/jobs/cd8fc448-da4e-4369-bb71-00b6c025e0d4/images/ddea9daa7fd3d33eb191ba727c6e27580db7acdc46d34476b0466a27cac524af.jpeg ; derivati pubblici locali necessari al manifest/offline.
- Verifiche: iterazione4 backend Web Push 14/14, manifest/meta/SW/cache/offline e layout 320/390/iPad; iterazione5 creazione/join/PIN/sessione persistente/Google assente. Corretto URL /undefined via fallback env. Corretti fogli attività/premi su 375x667 (altezza limitata, ScrollView web, salvataggio fisso) e login duplicato via useIsFocused di expo-router. Completata self-verification reale browser: assegnazione Luca, nota/chat, completamento e punti, creazione/riscatto premio, deep link con sessione, impegno calendario 17–18, logout con un solo login. Vedi `/app/test_reports/pwa_final_verification.md`.

## Backlog / next
- P0: solo verifica utente su dispositivi reali di installazione dalla Home e ricezione push (iOS/iPadOS 16.4+). Nel browser automatico permission=denied: verificata guida permessi bloccati; non dichiarare consegna fisica verificata.
- Il vecchio relay push NATIVO non è configurato (chiave placeholder/Firebase assente): non necessario per la PWA. Rimosso riferimento app.json a google-services.json inesistente; aggiungerlo solo se si riprenderà lo sviluppo nativo. Non chiedere Firebase per il flusso web.
- Google non è più offerto nell’interfaccia; vecchio backend OAuth mantenuto per compatibilità dati/sessioni, non parte del flusso attuale.
- P1: Compiti ricorrenti - modifica/elimina di tutta la serie.
- P2: Statistiche settimanali per membro.
- P2: Modalità dark.
