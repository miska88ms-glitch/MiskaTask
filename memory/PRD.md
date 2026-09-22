# Family Task — PRD

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
- Backend API: auth (Google + device family/create), invite code join/regenerate, members CRUD + verify-pin, activities CRUD + complete/uncomplete + single GET + recurring (dates[]) + end_time, commenti (chat), rewards CRUD (capo) + redeem + redemptions, leaderboard, presets, register-push. RBAC, soft delete, punti con rollback, notifiche push (assegnazione/chat/completamento/riscatto).
- Frontend: login (crea/Google/unisciti con codice), crea-famiglia (nota codice + colore custom), join-family, selezione membro con PIN, tab Oggi/Calendario/Classifica/Profilo, dettaglio task (/task/[id]) con nota + chat, Premi (/rewards) con riscatto e storico, impegni personali con colore distinto (slate) e orario inizio–fine, compiti ricorrenti (giorni + settimane), colore accento personalizzabile per utente (preset + ruota colore), codice invito visibile (copia/condividi/rigenera).
- Notifiche push: expo-notifications + register-push; funziona solo dopo deploy+build reale con google-services.json (in attesa dal cliente).
- Testing: iter1 (26) + iter2 + iter3 (20) backend + E2E frontend, tutti superati.

## Backlog / next
- Notifiche push: integrare google-services.json fornito dal cliente, poi build.
- P1: Compiti ricorrenti - modifica/elimina di tutta la serie.
- P2: Statistiche settimanali per membro.
- P2: Modalità dark.
