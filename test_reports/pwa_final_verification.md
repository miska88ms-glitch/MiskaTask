# Family Task PWA — verifica finale, 2026-09-22

## Modifiche richieste
- Webapp mobile installabile Android e Apple, mantenendo tutte le funzioni.
- Rimosso «Accedi con Google» su richiesta esplicita. Accesso tramite crea famiglia / codice invito / profilo PIN.

## Test automatici precedenti
- Iter4: 14/14 test backend Web Push; HTTPS manifest/SW/offline/cache/icone e layout piccoli/tablet verificati.
- Iter5: creazione, ingresso con codice, PIN e persistenza confermati. Segnalazioni ActivitySheet fuori viewport e login duplicato risolte e riverificate dal main.

## Browser E2E reale dopo correzioni (nessuna sostituzione API)
- 375x667: ingresso 63RMST e PIN Mamma1234.
- Campo titolo e chip Luca cliccabile senza force; attività creata `act_7e0a97316755`, assegnata `mem_6e7ea717c881`, risposta200.
- Nota «Nota di verifica della webapp» e chat «Messaggio dalla webapp» salvate e visibili.
- Premio `rwd_f5a519f23b89`, costo5, creato dal capo.
- Cambio profilo Luca PIN1111; completa compito10 punti; riscatta premio, risposta con5 punti residui e storico visibile.
- Navigazione diretta `/task/act_7e0a97316755` mantiene sessione e dettaglio corretto.
- 390x844: calendario, impegno personale `act_1a9aac90dad5` 17:00–18:00 creato come Luca, risposta200.
- Impostazioni notifiche caricate. Browser automatico espone Notification/PushManager/SW ma permission=denied: guida impostazioni presente, nessun comando di attivazione improprio.
- Uscita dalla famiglia: login visibile, `join-family-btn` count1, `google-login-btn` count0.
- ID calendario ora separati da Oggi: `calendar-add-activity-fab`, `calendar-activity-card-*`, `calendar-toggle-*`.

## Limiti non verificabili qui
- Installazione effettiva Home e ricezione Web Push su dispositivi fisici Android/iPhone/iPad ancora da verificare dall’utente.
- I test di trasporto Web Push usano sostituzioni SOLO nel test unitario; l’app non usa API simulate.
- Vecchio relay push nativo non configurato, fuori dal flusso PWA. Google non più offerto; record e sessioni storiche non cancellati.