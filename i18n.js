/* IronBlind: traduzione italiano -> inglese dell'interfaccia.
   L'app è scritta in italiano. Se la lingua scelta (o quella del telefono) non è l'italiano,
   questo modulo traduce testi, segnaposto ed etichette man mano che compaiono nella pagina. */
let getLang = () => 'it';
export function setLangGetter(f) { getLang = f; }

const E = {
  /* generale */
  'Caricamento': 'Loading', 'Sto aprendo i profili e gli scambi.': 'Opening profiles and swaps.',
  'Esci': 'Log out', 'Esplora': 'Explore', 'Scambi': 'Swaps', 'Profilo': 'Profile', 'Impostazioni': 'Settings', 'Cambia app': 'Change app', 'App aggiornata': 'App updated', '⚙️ Impostazioni': '⚙️ Settings', 'Notifiche, lingua, informazioni sull\'app e account.': 'Notifications, language, app info and account.', 'Seguici': 'Follow us',
  'Chi siamo': 'About us', "Come installare l'app": 'How to install the app', 'Assistenza': 'Support',
  'Guida ai 12 tester': 'Guide to the 12 testers', 'Link utili': 'Useful links',
  'IronBlind su Instagram': 'IronBlind on Instagram', 'IronBlind su Facebook': 'IronBlind on Facebook',
  '← Indietro': '← Back', 'Annulla': 'Cancel', 'Chiudi': 'Close', 'Copia': 'Copy', 'Salva profilo': 'Save profile',
  "Il browser sta mostrando la versione per computer. Per vedere l'app a misura di telefono apri il menu ⋮ di Chrome e togli la spunta da": 'The browser is showing the desktop version. To see the phone-sized app, open the Chrome menu ⋮ and untick',
  'Sito desktop': 'Desktop site',
  /* accesso */
  'Accedi per iniziare': 'Sign in to get started',
  "Sei stato invitato da un amico: registrati e pubblica la tua app per sbloccargli un'app extra.": 'A friend invited you: sign up and publish your app to unlock an extra app for them.',
  'Crei il profilo, proponi scambi e chatti con gli altri sviluppatori. Se è la prima volta con email e password, tocca Registrati.': 'Create your profile, propose swaps and chat with other developers. If this is your first time with email and password, tap Sign up.',
  'Accedi con Google': 'Sign in with Google', 'oppure con email e password': 'or with email and password',
  'Email': 'Email', 'Password': 'Password', 'Accedi': 'Sign in', 'Registrati': 'Sign up', 'Password dimenticata': 'Forgot password',
  'nome@esempio.it': 'name@example.com', 'Almeno 6 caratteri': 'At least 6 characters',
  /* esplora */
  'Sviluppatori': 'Developers', 'Iscritti': 'Registered', 'Test in': 'Tests in', 'Corso': 'progress', 'Pubblicate': 'Published',
  "Cerca un'app": 'Search for an app', 'Nome, categoria o sviluppatore': 'Name, category or developer',
  'Paese dello sviluppatore': "Developer's country", 'Tutti i paesi': 'All countries', 'tutti i paesi': 'all countries',
  'Nessun feedback': 'No feedback yet', 'APP DA TESTARE': 'APP TO TEST', '📱 APP DA TESTARE': '📱 APP TO TEST', 'Paese n.d.': 'Country n/a',
  '🧩 App extra': '🧩 Extra app', 'Proponi scambio 1 a 1': 'Propose a 1-to-1 swap', 'Apri scambio': 'Open swap', 'Apri': 'Open',
  'Con quale tua app?': 'With which of your apps?', 'Completa prima il tuo profilo': 'Complete your profile first',
  'Nessuna delle tue app è compatibile o libera per questo scambio.': 'None of your apps is compatible or free for this swap.',
  'Nessuna app da testare per ora': 'No apps to test for now',
  'Prova con un altro nome, categoria o paese.': 'Try another name, category or country.',
  'Pubblica la tua app dal profilo e invita altri sviluppatori.': 'Publish your app from your profile and invite other developers.',
  'Link copiato!': 'Link copied!', 'Copia link': 'Copy link',
  /* inviti */
  "Vuoi far testare un'altra app?": 'Want to get another app tested?',
  "Invita un amico: quando si registra e pubblica la sua app sblocchi un'app extra, anche se la precedente è in fase di test.": 'Invite a friend: when they sign up and publish their app you unlock an extra app, even if the previous one is still in testing.',
  'Invita un amico': 'Invite a friend', 'Invita un amico (gratis)': 'Invite a friend (free)', '👥 Invita un amico (gratis)': '👥 Invite a friend (free)',
  /* scambi */
  'Nessuno scambio': 'No swaps yet',
  "Scegli un'app in Esplora e proponi uno scambio: tu testi la sua, lui testa la tua.": 'Pick an app in Explore and propose a swap: you test theirs, they test yours.',
  'Vai a Esplora': 'Go to Explore', 'Richieste ricevute': 'Requests received', 'In corso': 'In progress', 'Richieste inviate': 'Requests sent', 'Completati': 'Completed',
  'Completato': 'Completed', 'Richiesta ricevuta': 'Request received', 'In attesa': 'Pending',
  'TU TESTI': 'YOU TEST', 'LUI TESTA': 'THEY TEST', 'la sua app': 'their app', 'la tua app': 'your app', 'La tua app': 'Your app',
  'Accetta': 'Accept', 'Rifiuta': 'Decline',
  'Scambio non trovato': 'Swap not found',
  'Il link di test non è disponibile.': 'The test link is not available.',
  'Il link di test si sblocca quando lo scambio viene accettato.': 'The test link unlocks when the swap is accepted.',
  'Apri link di test': 'Open test link',
    'Annulla richiesta': 'Cancel request',
  'Scambio delle email': 'Email exchange', 'La tua': 'Yours', 'La sua': 'Theirs',
  'Aggiungi la sua email tra i tester della tua app in Play Console e usa il suo link per entrare nel test.': 'Add their email to your app’s testers in Play Console and use their link to join the test.',
  'Le email si vedono solo quando le condividete entrambi. La sua si sblocca dopo che hai condiviso la tua.': 'Emails are visible only when you both share them. Theirs unlocks after you share yours.',
  'Condividi la mia email': 'Share my email', 'Aggiungi la tua email nel profilo': 'Add your email in your profile',
  'Test di 14 giorni': '14-day test', 'Lui su': 'They on',
  "Ho installato l'app, avvia i 14 giorni": 'I installed the app, start the 14 days',
  "Potrai avviare il test quando avrai il link dell'app da installare.": 'You can start the test once you have the link to the app to install.',
  'Feedback reciproco': 'Mutual feedback', 'Hai inviato il tuo feedback.': 'You sent your feedback.',
  'Scambio completato: conta come un tester per entrambi.': 'Swap completed: it counts as a tester for both.',
  'Commento': 'Comment', 'Invia feedback': 'Send feedback', 'Puntualità, qualità delle segnalazioni, comunicazione': 'Punctuality, quality of reports, communication',
  'Chat': 'Chat', 'Invia': 'Send', 'Nessun messaggio. Presentati e concorda come procedere.': 'No messages yet. Introduce yourself and agree on how to proceed.',
  "Se l'altro non risponde più puoi chiudere lo scambio. La tua app si libera e potrai cambiarla.": 'If the other person stops responding you can close the swap. Your app is freed up and you can change it.',
  'Conferma: chiudi scambio': 'Confirm: close swap', 'Non chiudere': 'Keep open', 'Chiudi scambio': 'Close swap',
  'Nessun feedback ricevuto.': 'No feedback received.', 'Feedback ricevuti': 'Feedback received',
  /* profilo */
  'Il tuo profilo': 'Your profile', 'Nome visibile': 'Display name', 'Come ti chiamano gli altri': 'What others call you', 'Chi sei': 'About you', 'Una riga su di te': 'A line about you',
  "Email dell'account Google per i test": 'Google account email for testing', 'nome@gmail.com': 'name@gmail.com',
  'Resta privata. Viene condivisa solo dentro uno scambio e solo se condividi anche tu.': 'Stays private. Shared only inside a swap, and only if you share yours too.',
  'Il tuo paese': 'Your country', 'Scegli il tuo paese': 'Choose your country',
  'Serve per far combaciare le richieste di tester. Lo scrivi tu, non viene verificato.': 'Used to match tester requests. You enter it yourself, it is not verified.',
  '📱 La tua app': '📱 Your app', 'Nome': 'Name', "Nome dell'app": 'App name', 'Categoria': 'Category', 'Link di adesione al test': 'Test opt-in link',
  'Resta privato: lo vede solo chi accetta uno scambio con te.': 'Stays private: only visible to whoever accepts a swap with you.',
  'Tester che ti servono': 'Testers you need', 'Qualsiasi paese': 'Any country',
  'Vedrai e potrai scambiare solo con chi è di quel paese e accetta il tuo.': 'You will only see and swap with people from that country who accept yours.',
  'Cosa deve provare il tester': 'What the tester should try', "Cosa fa l'app e cosa vorresti che controllasse": 'What the app does and what you would like checked',
  'Principale': 'Main', 'Bloccata': 'Locked', 'In uso': 'In use', 'Sbloccato · libero': 'Unlocked · free',
  'Spazio sbloccato. Lascialo vuoto se non ti serve.': 'Slot unlocked. Leave it empty if you do not need it.',
  'Concludi app e libera lo slot': 'Finish app and free the slot', 'Concludere questa app?': 'Finish this app?',
  'Viene tolta dal profilo e lo slot si azzera. Per usarlo di nuovo dovrai invitare un altro amico. Gli scambi già completati restano.': 'It is removed from your profile and the slot resets. To use it again you will need to invite another friend. Completed swaps stay.',
  'Sì, concludi': 'Yes, finish it',
  '+ Aggiungi un\'altra app': '+ Add another app',
    'Tester completati': 'Testers completed', 'Valutazione media': 'Average rating',
  'Google Play chiede 12 tester per 14 giorni consecutivi. Conta ogni persona che ha testato la tua app per 14 giorni e ha lasciato il feedback.': 'Google Play requires 12 testers for 14 consecutive days. Every person who tested your app for 14 days and left feedback counts.',
  'Completa il profilo e pubblica la tua app per poter proporre scambi.': 'Complete your profile and publish your app to be able to propose swaps.',
  /* lune e slot */
  'Le tue Lune': 'Your Moons',
  'Lune': 'Moons', 'Lune per sbloccare uno Slot Extra': 'Moons to unlock an Extra Slot',
  'Hai già il massimo di slot extra.': 'You already have the maximum number of extra slots.',
  '🌕 Con le Lune (gratis)': '🌕 With Moons (free)',
  'Quando si registra con il tuo link e pubblica la sua app, ottieni uno slot extra.': 'When they sign up with your link and publish their app, you get an extra slot.',
  'Paga con PayPal e scrivi nella nota il tuo codice. Dopo la verifica, di solito entro 24 ore, lo slot si sblocca da solo.': 'Pay with PayPal and write your code in the note. After verification, usually within 24 hours, the slot unlocks on its own.',
  'Il tuo codice': 'Your code', 'Copia codice': 'Copy code', 'con PayPal': 'with PayPal',
  'Nome o email usati su PayPal': 'Name or email used on PayPal', 'Ho pagato, avvisa': 'I paid, notify me',
  'Slot app extra': 'Extra app slot',
  "Hai usato lo slot gratuito. Per far testare un'altra app scegli una strada:": 'You used the free slot. To get another app tested, choose one way:',
  'Copia non disponibile': 'Copy not available',
  /* admin */
  'Sblocca con il codice': 'Unlock with code', 'Codice utente': 'User code', 'Sblocca +1 slot': 'Unlock +1 slot',
  'Richieste slot (solo tu)': 'Slot requests (you only)', 'Nessuna richiesta in attesa.': 'No pending requests.', 'Elimina richiesta': 'Delete request', 'non indicato': 'not provided',
  /* account */
  'Account e privacy': 'Account and privacy', "Elimina il mio account": 'Delete my account', 'Cosa succede': 'What happens',
  "Vengono eliminati:": 'Deleted:', "Vengono chiusi:": 'Closed:', 'Restano, in forma anonima:': 'Remain, anonymously:',
  "L'operazione non si può annullare.": 'This cannot be undone.', 'Scrivi ELIMINA per confermare': 'Type ELIMINA to confirm', 'La tua password': 'Your password',
  'Ti verrà chiesto di accedere di nuovo con Google per confermare.': 'You will be asked to sign in with Google again to confirm.', 'Elimina definitivamente': 'Delete permanently',
  /* chi siamo, guida */
  '🚀 Chi siamo': '🚀 About us', '☕ Sostieni IronBlind': '☕ Support IronBlind', 'Offrimi un caffè': 'Buy me a coffee', 'Offrimi un caffè con PayPal': 'Buy me a coffee with PayPal',
  'IronBlind (ironblind.it) nasce per aiutare gli sviluppatori indipendenti a superare il requisito di 12 tester per 14 giorni imposto da Google Play Console. La nostra community permette agli sviluppatori di fare squadra, testare reciprocamente le app e scambiare feedback costruttivi.': 'IronBlind (ironblind.it) was born to help independent developers meet Google Play Console’s requirement of 12 testers for 14 days. Our community lets developers team up, test each other’s apps and exchange constructive feedback.',
  'IronBlind è gratuita. Se ti è utile puoi offrirmi un caffè con PayPal, con l\'importo che preferisci. Non sblocca nulla: è solo un grazie.': 'IronBlind is free. If it is useful to you, you can buy me a coffee with PayPal, for any amount you like. It unlocks nothing: it is just a thank-you.',
  "Come installare l'app": 'How to install the app', '📱 Come installare IronBlind sul telefono (PWA)': '📱 How to install IronBlind on your phone (PWA)',
  "IronBlind è una Progressive Web App (PWA). Puoi aggiungerla alla schermata Home del telefono per usarla come un'app nativa:": 'IronBlind is a Progressive Web App (PWA). You can add it to your phone’s home screen and use it like a native app:',
  'Android (Chrome):': 'Android (Chrome):', 'iPhone/iPad (Safari):': 'iPhone/iPad (Safari):',
  'Menu ⋮ in alto a destra ➔ "Aggiungi a schermata Home" o "Installa app".': 'Menu ⋮ at the top right ➔ "Add to Home screen" or "Install app".',
  'Tasto Condividi (quadrato con freccia in alto) ➔ "Aggiungi alla schermata Home".': 'Share button (square with an up arrow) ➔ "Add to Home Screen".',
  "Stai già usando l'app installata: non devi fare nulla.": 'You are already using the installed app: nothing to do.',
  /* notifiche, lingua */
  '🔔 Notifiche sul telefono': '🔔 Phone notifications', 'Attive': 'On', 'Attiva notifiche': 'Turn on notifications', 'Disattiva notifiche': 'Turn off notifications',
  "Ricevi una notifica per nuovi messaggi, proposte e scambi accettati. Funziona finché l'app è aperta o in secondo piano: se Android la chiude, non arrivano.": 'Get a notification for new messages, proposals and accepted swaps. It works while the app is open or in the background: if Android closes it, they will not arrive.',
  'Le notifiche sono bloccate per questo sito: abilitale dalle impostazioni del browser.': 'Notifications are blocked for this site: enable them in your browser settings.',
  '🌍 Lingua / Language': '🌍 Language / Lingua', 'Lingua': 'Language', 'Automatica (segue il telefono)': 'Automatic (follows your phone)', 'Italiano': 'Italiano', 'English': 'English',
  'Vedi un messaggio di esempio': 'See a sample message', 'Grazie!': 'Thanks!',
  /* messaggi (toast) */
  'Operazione non consentita dalle regole di sicurezza.': 'Operation not allowed by the security rules.', 'Connessione assente. Riprova.': 'No connection. Try again.',
  'Qualcosa è andato storto. Riprova tra poco.': 'Something went wrong. Try again shortly.',
  "L'email non è valida.": 'The email is not valid.', 'Scrivi la password.': 'Enter the password.', 'La password deve avere almeno 6 caratteri.': 'The password must be at least 6 characters.',
  'Esiste già un account con questa email. Usa Accedi.': 'An account with this email already exists. Use Sign in.', 'Email o password sbagliate.': 'Wrong email or password.',
  'Troppi tentativi. Aspetta qualche minuto e riprova.': 'Too many attempts. Wait a few minutes and try again.', 'Accesso non riuscito. Riprova.': 'Sign-in failed. Try again.',
  'Scrivi prima la tua email.': 'Enter your email first.', "Ti ho inviato un'email per scegliere una nuova password.": 'I sent you an email to choose a new password.',
  'Email copiata': 'Email copied', 'Codice copiato': 'Code copied', 'Copia non disponibile: seleziona il testo a mano': 'Copy not available: select the text by hand',
  'Non hai abbastanza Lune.': 'You do not have enough Moons.',
  'Richiesta inviata. Sblocchiamo lo slot dopo aver verificato il pagamento.': 'Request sent. We unlock the slot after verifying the payment.',
  'Codice non trovato. Controlla di averlo copiato per intero.': 'Code not found. Check that you copied it in full.', 'Richiesta eliminata': 'Request deleted',
  'Questa app ha ancora scambi aperti.': 'This app still has open swaps.', 'App conclusa. Lo slot si è azzerato: invita un altro amico per riaverlo.': 'App finished. The slot has reset: invite another friend to get it back.',
  'Pubblica prima la tua app nel profilo.': 'Publish your app in your profile first.', 'Avete già uno scambio aperto con queste app.': 'You already have an open swap with these apps.',
  'Scegli prima il tuo paese nel profilo.': 'Choose your country in your profile first.', 'Scambio non compatibile con i paesi richiesti.': 'Swap not compatible with the requested countries.',
  'Richiesta inviata': 'Request sent', "L'app di questo scambio non è più nel tuo profilo.": 'The app in this swap is no longer in your profile.',
  'Aggiungi nel profilo il link di adesione al test della tua app, poi accetta.': 'Add your app’s test opt-in link in your profile, then accept.',
  'Scambio accettato': 'Swap accepted', 'Scambio chiuso': 'Swap closed', 'Richiesta annullata': 'Request cancelled', 'Richiesta rifiutata': 'Request declined',
  'Aggiungi la tua email nel profilo.': 'Add your email in your profile.', 'Email condivisa': 'Email shared', "Prima ti serve il link dell'app da installare.": 'You first need the link of the app to install.',
  'Test avviato': 'Test started', 'Scegli da 1 a 5 stelle.': 'Choose 1 to 5 stars.', 'Feedback inviato': 'Feedback sent',
  'Scrivi la tua email.': 'Enter your email.', 'Scrivi il nome visibile.': 'Enter your display name.', 'Scegli il tuo paese.': 'Choose your country.', "Controlla l'email.": 'Check the email.',
  'Il link deve iniziare con https://': 'The link must start with https://', 'Profilo salvato': 'Profile saved',
  'Profilo salvato. Il tuo invito è stato registrato: grazie!': 'Profile saved. Your invitation was recorded: thank you!',
  "Profilo salvato. Aggiungi la tua app per comparire in Esplora.": 'Profile saved. Add your app to appear in Explore.',
  'Pagamento confermato! Slot extra sbloccato: aggiungi la nuova app dal Profilo.': 'Payment confirmed! Extra slot unlocked: add the new app from your Profile.',
  'Account eliminato.': 'Account deleted.', 'Scrivi ELIMINA per confermare.': 'Type ELIMINA to confirm.', 'Scrivi la tua password per confermare.': 'Enter your password to confirm.',
  'Questo browser non supporta le notifiche.': 'This browser does not support notifications.', 'Permesso negato. Puoi attivarlo dalle impostazioni del sito nel browser.': 'Permission denied. You can enable it in the site settings of your browser.',
  'Notifiche attivate.': 'Notifications turned on.', 'Non sono riuscito ad attivare le notifiche.': 'I could not turn on notifications.', 'Notifiche disattivate.': 'Notifications turned off.',
  'Notifiche attive': 'Notifications on', "Ti avviso di nuovi messaggi e richieste finché l'app resta aperta.": 'I will let you know about new messages and requests while the app stays open.',
  "Se hai ricevuto un pagamento ma non c'è la richiesta, incolla qui il codice scritto nel messaggio di PayPal.": 'If you received a payment but there is no request, paste here the code written in the PayPal message.', 'Incolla il codice': 'Paste the code',
  "profilo, nome dell'app, email e link di test, messaggi che hai inviato e testo dei feedback che hai scritto.": 'profile, app name, email and test links, messages you sent and the text of the feedback you wrote.',
  'gli scambi in corso e le richieste in attesa.': 'ongoing swaps and pending requests.',
  "le stelle che hai dato e gli scambi già completati, perché contano per l'altro sviluppatore. I feedback ricevuti non sono più collegati a nessun profilo.": 'the stars you gave and the swaps already completed, because they count for the other developer. Feedback received is no longer linked to any profile.',
  'Accesso con email non attivo: abilitalo in Firebase > Authentication.': 'Email sign-in is not enabled: enable it in Firebase > Authentication.',
  'Dominio non autorizzato: aggiungilo in Firebase > Authentication > Impostazioni.': 'Unauthorized domain: add it in Firebase > Authentication > Settings.',
  'Manca la configurazione di Firebase': 'Firebase configuration is missing',
  'Apri il file firebase-config.js e incolla i valori del tuo progetto Firebase. I passaggi sono nel README.': 'Open firebase-config.js and paste the values of your Firebase project. The steps are in the README.',
  /* categorie */
  'Giochi': 'Games', 'Produttività': 'Productivity', 'Social': 'Social', 'Strumenti': 'Tools', 'Salute e fitness': 'Health & fitness', 'Istruzione': 'Education', 'Finanza': 'Finance', 'Altro': 'Other',
  /* paesi */
  'Italia': 'Italy', 'Belgio': 'Belgium', 'Brasile': 'Brazil', 'Cina': 'China', 'Croazia': 'Croatia', 'Danimarca': 'Denmark', 'Egitto': 'Egypt', 'Filippine': 'Philippines', 'Finlandia': 'Finland', 'Francia': 'France',
  'Germania': 'Germany', 'Giappone': 'Japan', 'Grecia': 'Greece', 'Irlanda': 'Ireland', 'Messico': 'Mexico', 'Paesi Bassi': 'Netherlands', 'Polonia': 'Poland', 'Portogallo': 'Portugal', 'Regno Unito': 'United Kingdom',
  'Spagna': 'Spain', 'Stati Uniti': 'United States', 'Svezia': 'Sweden', 'Svizzera': 'Switzerland', 'Turchia': 'Türkiye', 'Ucraina': 'Ukraine'
};

const plural = (n, one, many) => (Number(n) === 1 ? one : many);
/* Modelli con parti variabili: {} = testo qualsiasi (viene tradotto a sua volta). */
const P = [
  [/^La lingua dell'app e dei messaggi segue quella del telefono: italiano se è in italiano, altrimenti inglese\. Ora: (.+)\.$/, (m, t) => `The language of the app and messages follows your phone: Italian if it is in Italian, otherwise English. Now: ${t(m[1])}.`],
  [/^Tu su (.+)$/, m => `You on ${m[1]}`], [/^Lui su (.+)$/, m => `They on ${m[1]}`], [/^Valutazione$/, () => 'Rating'], [/^(\d+) stell[ae]$/, m => `${m[1]} ${plural(m[1], 'star', 'stars')}`],
  [/^(\d+) su (\d+) Lune$/, m => `${m[1]} of ${m[2]} Moons`],
  [/^\. Vuoi far testare un'altra app subito\? Usa le Lune o invita un amico qui sopra\.$/, () => '. Want another app tested right away? Use Moons or invite a friend above.'],
  [/^Hai usato lo slot gratuito\. Sblocca uno slot con le Lune, invitando un amico o subito per (.+)\.$/, m => `You used the free slot. Unlock a slot with Moons, by inviting a friend, or right away for ${m[1]}.`],
  [/^Per informazioni o per segnalare un problema scrivi a$/, () => 'For information or to report a problem write to'],
  [/^\. Puoi eliminare il tuo account e i tuoi dati in qualsiasi momento\.$/, () => '. You can delete your account and your data at any time.'],
  [/^(.+) propone di testarsi a vicenda\.$/, m => `${m[1]} proposes testing each other.`],
  [/^Ogni giorno di test completato = \+1 Luna\. Hai (.+) Lune: servono 20\.$/, m => `Every completed test day = +1 Moon. You have ${m[1]} Moons: you need 20.`],
  [/^Paga (.+) con PayPal$/, m => `Pay ${m[1]} with PayPal`], [/^Facoltativo, aiuta a trovare il pagamento$/, () => 'Optional, helps find the payment'],
  [/^Giorno (\d+) di 14$/, m => `Day ${m[1]} of 14`],
  [/^(\d+) giorni completati$/, m => `${m[1]} days completed`],
  [/^(\d+) nuovi messaggi$/, m => `${m[1]} new messages`],
  [/^Nuovo messaggio$/, () => 'New message'],
  [/^Ha avviato il test$/, () => 'Started the test'], [/^Ha lasciato il feedback$/, () => 'Left feedback'], [/^Ha accettato lo scambio$/, () => 'Accepted the swap'],
  [/^Nuovo messaggio da (.+)$/, m => `New message from ${m[1]}`],
  [/^(.+) ti ha proposto uno scambio$/, m => `${m[1]} proposed a swap to you`],
  [/^(.+) ha accettato lo scambio$/, m => `${m[1]} accepted the swap`],
  [/^(.+) ha avviato il test$/, m => `${m[1]} started the test`],
  [/^(.+) ha lasciato il feedback$/, m => `${m[1]} left feedback`],
  [/^(\d+) novità$/, m => `${m[1]} updates`], [/^(\d+) stelle su 5$/, m => `${m[1]} stars out of 5`], [/^(\d+) tester su 12$/, m => `${m[1]} testers out of 12`],
  [/^(\d+) sviluppatori iscritti, (\d+) test in corso, (\d+) app pubblicate$/, m => `${m[1]} developers registered, ${m[2]} tests in progress, ${m[3]} apps published`],
  [/^Cerca: (.+)$/, (m, t) => `Looking for: ${t(m[1])}`], [/^Solo (.+)$/, (m, t) => `Only ${t(m[1])}`],
  [/^(\d+) tester completati$/, m => `${m[1]} ${plural(m[1], 'tester', 'testers')} completed`],
  [/^Tester completati · (.+)$/, m => `Testers completed · ${m[1]}`],
  [/^(\d+) app nascost[ae] perché non (?:è|sono) compatibili con i paesi richiesti da te o da loro\.$/, m => `${m[1]} ${plural(m[1], 'app hidden because it is', 'apps hidden because they are')} not compatible with the countries requested by you or them.`],
  [/^Scrivi a (.+) \(max 200 caratteri\)$/, m => `Write to ${m[1]} (max 200 characters)`], [/^Messaggio, massimo 200 caratteri$/, () => 'Message, maximum 200 characters'],
  [/^Richiesta inviata\. Quando (.+) accetta si apre la chat\.$/, m => `Request sent. When ${m[1]} accepts, the chat opens.`],
  [/^Hai condiviso la tua email\. Aspetta che lo faccia anche (.+) per vedere la sua\.$/, m => `You shared your email. Wait for ${m[1]} to do the same to see theirs.`],
  [/^Aspetto quello di (.+)\.$/, m => `Waiting for ${m[1]}’s.`],
  [/^Come ha lavorato (.+) durante lo scambio\?$/, m => `How did ${m[1]} do during the swap?`], [/^Feedback di (.+)$/, m => `Feedback from ${m[1]}`],
  [/^Si sblocca dopo 14 giorni di test: mancano (\d+) giorni\.$/, m => `Unlocks after 14 days of testing: ${m[1]} days left.`],
  [/^Si sblocca dopo 14 giorni di test\. Avvia il tuo test per far partire il conteggio\.$/, () => 'Unlocks after 14 days of testing. Start your test to begin the count.'],
  [/^(\d+) ?\/ ?(\d+) amici$/, m => `${m[1]}/${m[2]} friends`],
  [/^Inviti disponibili: (\d+)\. Gli amici contano quando hanno pubblicato la loro app\. Quando concludi un'app extra lo slot si azzera e per riaverlo serve invitare un altro amico\.$/, m => `Invites available: ${m[1]}. Friends count once they have published their app. When you finish an extra app the slot resets, and to get it back you need to invite another friend.`],
  [/^Ogni amico che si registra con il tuo link e pubblica la sua app ti sblocca uno spazio per un'app extra da far testare, anche se la precedente è in fase di test\. Massimo (\d+) app extra\.$/, m => `Every friend who signs up with your link and publishes their app unlocks a slot for an extra app to get tested, even if the previous one is still in testing. Maximum ${m[1]} extra apps.`],
  [/^Ogni giorno di test completato ti dà \+1 Luna \(massimo 14 per scambio\)\. Con 20 Lune sblocchi uno slot extra\. Ne hai (\d+)\/20\.$/, m => `Every completed test day gives you +1 Moon (maximum 14 per swap). With 20 Moons you unlock an extra slot. You have ${m[1]}/20.`],
  [/^Usa 20 Lune per sbloccare uno Slot Extra$/, () => 'Use 20 Moons to unlock an Extra Slot'],
  [/^Ogni giorno di test completato = \+1 Luna\. Hai (\d+) Lune: servono 20 Lune per sbloccare uno Slot Extra\. Te ne mancano (\d+)\.$/, m => `Every completed test day = +1 Moon. You have ${m[1]} Moons: you need 20 to unlock an Extra Slot. ${m[2]} to go.`],
  [/^(\d+) Lune$/, m => `${m[1]} ${plural(m[1], 'Moon', 'Moons')}`], [/^🌕 (\d+) Lune$/, m => `🌕 ${m[1]} ${plural(m[1], 'Moon', 'Moons')}`],
  [/^Te ne mancano (\d+)$/, m => `${m[1]} to go`],
  [/^⚡ Subito: (.+)$/, (m, t) => `⚡ Right away: ${m[1]}`],
  [/^Slot extra sbloccato con (\d+) Lune! Aggiungi la nuova app dal Profilo\.$/, m => `Extra slot unlocked with ${m[1]} Moons! Add the new app from your Profile.`],
  [/^Slot sbloccato per (.+?)(?: \(totale pagati: (\d+)\))?$/, m => `Slot unlocked for ${m[1]}${m[2] ? ' (total paid: ' + m[2] + ')' : ''}`],
  [/^Copia non disponibile: (.+)$/, m => `Copy not available: ${m[1]}`],
  [/^Aggiungi nel profilo il link di adesione al test di (.+)$/, m => `Add the test opt-in link of ${m[1]} in your profile`],
  [/^🧩 Slot App Extra #(\d+)$/, m => `🧩 Extra App Slot #${m[1]}`],
  [/^App bloccata: hai (\d+) scamb(?:io|i) apert[io]\. Puoi cambiarla quando tutti gli scambi di questa app sono completati, rifiutati o chiusi\. Li trovi in$/, m => `App locked: you have ${m[1]} open ${plural(m[1], 'swap', 'swaps')}. You can change it when all swaps of this app are completed, declined or closed. Find them in`],
  [/^Vuoi far testare un'altra app subito\? Usa le Lune o invita un amico qui sopra\.$/, () => 'Want another app tested right away? Use Moons or invite a friend above.'],
  [/^Pagamento in verifica: lo slot si sblocca appena confermato\.$/, () => 'Payment being verified: the slot unlocks as soon as it is confirmed.'],
  [/^Pagamento in verifica:$/, () => 'Payment being verified:'], [/^ lo slot si sblocca appena confermato\.$/, () => ' the slot unlocks as soon as it is confirmed.'],
  [/^Richiesta già inviata:$/, () => 'Request already sent:'], [/^ stiamo verificando il pagamento\.$/, () => ' we are verifying the payment.'],
  [/^(\d+)\/(\d+)$/, m => m[0]],
  [/^Ti invito su IronBlind Test App: ci scambiamo i test di 14 giorni per le nostre app Android\.$/, () => 'I invite you to IronBlind Test App: let’s swap the 14-day tests for our Android apps.']
];

/* Frasi composte: se il testo intero non è noto, si traducono le singole frasi. */
function tr1(s) {
  if (E[s] !== undefined) return E[s];
  for (const [re, f] of P) { const m = re.exec(s); if (m) return f(m, tr1); }
  return null;
}
export function tr(text) {
  if (getLang() === 'it' || typeof text !== 'string') return text;
  const lead = /^\s*/.exec(text)[0], trail = /\s*$/.exec(text)[0];
  const core = text.trim().replace(/\s+/g, ' ');
  if (!core) return text;
  let r = tr1(core);
  if (r === null) {
    const parts = core.split(/(?<=[.!?])\s+/);
    if (parts.length > 1) {
      let any = false; const out = parts.map(p => { const x = tr1(p); if (x !== null) { any = true; return x; } return p; });
      if (any) r = out.join(' ');
    }
  }
  return r === null ? text : lead + r + trail;
}

/* DOM: traduce testi e attributi, ricordando l'originale italiano per poter tornare indietro. */
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const orig = new WeakMap(), setTo = new WeakMap();
function doText(n) {
  const cur = n.data;
  if (setTo.get(n) === cur) { // l'ultimo valore l'ho scritto io: l'originale è quello salvato
    if (getLang() === 'it') { const o = orig.get(n); if (o !== undefined) { n.data = o; setTo.delete(n); } }
    else { const t = tr(orig.get(n)); if (t !== cur) { n.data = t; setTo.set(n, t); } }
    return;
  }
  orig.set(n, cur);
  if (getLang() === 'it') return;
  const t = tr(cur); if (t !== cur) { setTo.set(n, t); n.data = t; }
}
function doAttr(el, a) {
  const key = 'data-i18n-' + a; const cur = el.getAttribute(a); if (cur === null) return;
  const saved = el.getAttribute(key);
  if (saved !== null && el.__i18n && el.__i18n[a] === cur) { // valore scritto da me
    const t = getLang() === 'it' ? saved : tr(saved); if (t !== cur) { el.setAttribute(a, t); el.__i18n[a] = t; }
    return;
  }
  el.setAttribute(key, cur); const t = getLang() === 'it' ? cur : tr(cur);
  el.__i18n = el.__i18n || {};
  if (t !== cur) { el.setAttribute(a, t); el.__i18n[a] = t; } else el.__i18n[a] = cur;
}
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
export function applyDom(root) {
  const w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n = w.currentNode; const els = [], txt = [];
  while (n) { if (n.nodeType === 3) { if (!(n.parentNode && SKIP.has(n.parentNode.nodeName))) txt.push(n); } else if (n.nodeType === 1) els.push(n); n = w.nextNode(); }
  els.forEach(el => ATTRS.forEach(a => { if (el.hasAttribute(a)) doAttr(el, a); }));
  txt.forEach(doText);
}
let mo = null;
export function startI18n() {
  document.documentElement.lang = getLang() === 'it' ? 'it' : 'en';
  applyDom(document.body);
  if (mo) return;
  let busy = false;
  mo = new MutationObserver(list => {
    if (busy) return; busy = true;
    try {
      for (const m of list) {
        if (m.type === 'characterData') { if (m.target.parentNode && !SKIP.has(m.target.parentNode.nodeName)) doText(m.target); }
        else if (m.type === 'attributes') { if (!m.attributeName.startsWith('data-i18n')) doAttr(m.target, m.attributeName); }
        else m.addedNodes.forEach(x => { if (x.nodeType === 3) { if (x.parentNode && !SKIP.has(x.parentNode.nodeName)) doText(x); } else if (x.nodeType === 1) applyDom(x); });
      }
    } finally { busy = false; }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
