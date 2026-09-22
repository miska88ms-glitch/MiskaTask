# FamigliaTask — PRD

## Problem statement (original, Italian)
App mobile per la famiglia: i membri sono utenti diversi; si assegnano compiti di casa (studia, pulisci, fai la lavatrice) preimpostati o personalizzati; calendario gestito dal capo famiglia con tutte le attività, dove i membri possono al massimo visualizzare o aggiungere i propri impegni.

## User choices
- Accesso: Google login (Emergent-managed) + login semplice con nome e PIN.
- Creazione attività: il capo famiglia assegna + ogni membro può aggiungere i propri impegni.
- Gamification: sì, punti e classifica.
- Stile: personalizzabile per tutti e per singolo utente (colore accento per utente).
- Lingua: solo italiano.

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
- Backend API completa: auth/session (Google), family/create, family/join (codice invito), regenerate-code, auth/me, family, members CRUD + verify-pin, activities CRUD + complete/uncomplete + single GET, commenti (chat) list/add, leaderboard, presets, register-push. Indici Mongo, RBAC, soft delete, punti con rollback, notifiche push (relay Emergent) su assegnazione/chat/completamento.
- Frontend: login (crea/Google/unisciti con codice), crea-famiglia (con nota codice + colore custom), join-family, selezione membro con PIN pad, tab Oggi/Calendario/Classifica/Profilo, dettaglio task (/task/[id]) con nota (modificabile solo da creatore+capo) e chat commenti, indicatori nota/chat sulle card, gestione membri, colore accento personalizzabile per utente (preset + ruota colore), codice invito visibile con copia/condividi/rigenera.
- Notifiche push: expo-notifications + register-push; funziona solo dopo deploy+build reale con google-services.json.
- Testing: iterazione 1 (26/26) + iterazione 2 (46/46) backend + E2E frontend, tutti superati.

## Backlog / next
- P1: Premi/ricompense sbloccabili con i punti (badge, obiettivi).
- P1: Compiti ricorrenti (settimanali) e promemoria orari.
- P2: Statistiche settimanali per membro.
- P2: Modalità dark.
