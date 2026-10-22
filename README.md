# Blinders Test App

Web app per trovare tester per le app Android e superare i test chiusi di 14 giorni di Google Play.
Scambio 1 a 1: tu testi la sua app, lui testa la tua, poi feedback reciproco.

Sito statico (GitHub Pages) + Firebase (login Google e database Firestore).
Tutto gratuito per un uso piccolo.

## 1. Crea il progetto Firebase (10 minuti)

1. Vai su https://console.firebase.google.com e crea un progetto (puoi disattivare Google Analytics).
2. **Authentication** > Inizia > scheda *Metodo di accesso* > attiva **Google** ed **Email/Password**.
3. **Firestore Database** > Crea database > modalità produzione > scegli una regione europea (per esempio `eur3`).
4. Nella scheda **Regole** di Firestore cancella tutto, incolla il contenuto di `firestore.rules` e premi **Pubblica**.
5. **Impostazioni progetto** (ingranaggio) > *Le tue app* > icona web `</>` > registra l'app.
   Copia l'oggetto `firebaseConfig` e incolla i valori in `firebase-config.js`.
   Questi valori non sono segreti: la sicurezza sta nelle regole del punto 4.

## 2. Pubblica su GitHub Pages

1. Crea un repository su GitHub (per esempio `blinders-test-app`) e carica tutti i file di questa cartella nella radice.
2. Repository > **Settings** > **Pages** > *Build and deployment* > Source: **Deploy from a branch** > branch `main`, cartella `/ (root)` > Save.
3. Dopo un minuto il sito è su `https://TUO-UTENTE.github.io/blinders-test-app/`.

## 3. Autorizza il dominio per il login

Firebase > **Authentication** > **Impostazioni** > **Domini autorizzati** > Aggiungi `TUO-UTENTE.github.io`.
Senza questo passaggio il pulsante "Accedi con Google" dà errore.

## Provare con due account senza aspettare 14 giorni

Le regole controllano l'orario del server, quindi il feedback si sblocca davvero solo dopo 14 giorni.
Per un test veloce cambia due valori, poi rimettili:

1. In `firestore.rules`: `duration.value(14, 'd')` diventa `duration.value(1, 'm')`. Pubblica le regole.
2. In `firebase-config.js`: `TEST_DAYS = 14` diventa `TEST_DAYS = 0.001` (circa un minuto).

Avvia il test dallo scambio, aspetta un minuto e il modulo del feedback compare. Finito il test rimetti `14` in entrambi i file e ripubblica le regole.

## Cosa fanno le regole di sicurezza

- Le email personali sono leggibili solo dal proprietario.
- Dentro uno scambio vedi l'email dell'altro solo dopo aver condiviso la tua.
- Gli scambi e le chat sono visibili solo ai due partecipanti.
- Il link di test dell'altro si sblocca solo quando lo scambio è accettato.
- Una sola app per utente: finché ha scambi aperti, l'app nel profilo è bloccata. Questo controllo è nell'app, non nelle regole del database.
- Si può proporre uno scambio solo se i paesi richiesti da entrambi combaciano.
- Il feedback si può inviare solo dopo 14 giorni dall'avvio del tuo test, con l'orario del server.
- Nome, categoria, descrizione e testi hanno limiti di lunghezza anche lato server.

## Limiti noti

- Il paese è dichiarato dall'utente e non viene verificato.
- Il conteggio dei tester si basa sui feedback ricevuti. Funziona bene fino a qualche centinaio di utenti; oltre servirebbe un contatore aggregato.
- Il link di test dell'app è privato: lo legge solo l'altro partecipante, e solo quando lo scambio è stato accettato.
- Le regole non sono state provate con l'emulatore Firebase. Provale con due account prima di condividere il sito.
