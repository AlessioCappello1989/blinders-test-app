import { firebaseConfig, TEST_DAYS } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, collection, doc, setDoc, updateDoc, addDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
const CATS = ['Giochi', 'Produttività', 'Social', 'Strumenti', 'Salute e fitness', 'Istruzione', 'Finanza', 'Altro'];
const COUNTRIES = ['Italia', 'Albania', 'Argentina', 'Australia', 'Austria', 'Belgio', 'Brasile', 'Canada', 'Cina', 'Croazia', 'Danimarca', 'Egitto', 'Filippine', 'Finlandia', 'Francia', 'Germania', 'Giappone', 'Grecia', 'India', 'Indonesia', 'Irlanda', 'Messico', 'Paesi Bassi', 'Polonia', 'Portogallo', 'Regno Unito', 'Romania', 'Spagna', 'Stati Uniti', 'Svezia', 'Svizzera', 'Turchia', 'Ucraina', 'Altro'];

const view = $('#view');
const S = { tab: 'explore', route: null, users: new Map(), swaps: new Map(), fb: new Map(), priv: { email: '' }, q: '', star: {}, myEmail: undefined, theirEmail: undefined };
const loaded = { users: false, swaps: false, fb: false, priv: false };
let app, auth, db, me = null, busy = false, dirty = false, firstRoute = false;
let dataUnsubs = [], subUnsubs = [], subKey = '', msgs = [], tt;
const msgWatch = new Map();
S.lastMsg = new Map();

function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 3600); }
function toastErr(e) {
  const c = e && e.code;
  if (c === 'permission-denied') toast('Operazione non consentita dalle regole di sicurezza.');
  else if (c === 'unavailable') toast('Connessione assente. Riprova.');
  else toast('Qualcosa è andato storto. Riprova tra poco.');
  console.error(e);
}
const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (typeof v === 'number' ? v : 0);
const read = d => d.data({ serverTimestamps: 'estimate' });

/* ---------- Helpers di dominio ---------- */
const nameOf = id => (S.users.get(id) && S.users.get(id).nick) || 'Sviluppatore';
const av = id => '<span class="av ph">' + esc(nameOf(id)[0] || '?') + '</span>';
const members = s => s.members || [s.a, s.b];
const isDone = s => !!(s.fb && s.fb[s.a] && s.fb[s.b]);
const countryOf = id => (S.users.get(id) && S.users.get(id).country) || '';
const wantOf = id => (S.users.get(id) && S.users.get(id).app && S.users.get(id).app.want) || '';
const canTest = (tester, owner) => { const w = wantOf(owner); return !w || w === countryOf(tester); };
const compat = (a, b) => canTest(a, b) && canTest(b, a);
function mine() { const a = []; S.swaps.forEach((s, id) => a.push(Object.assign({ id }, s))); return a.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)); }
function pairOpen(o) { return mine().find(s => members(s).indexOf(o) > -1 && s.status !== 'declined' && !isDone(s)); }
/* ---------- Novità non lette (salvate su questo dispositivo) ---------- */
const seenKey = () => 'blinders-seen-' + me;
function getSeen() { try { return JSON.parse(localStorage.getItem(seenKey()) || '{}'); } catch (e) { return {}; } }
function markSeen(id) {
  if (!S.swaps.get(id)) return;
  const all = getSeen(); const lm = S.lastMsg.get(id);
  all[id] = { msg: Math.max(lm ? lm.at : 0, Date.now()), start: true, fb: true, acc: true };
  try { localStorage.setItem(seenKey(), JSON.stringify(all)); } catch (e) { /* senza memoria locale gli avvisi restano finché non cambia lo stato */ }
}
function unreadOf(s) {
  const seen = getSeen()[s.id] || {}; const o = s.a === me ? s.b : s.a; const out = []; const lm = S.lastMsg.get(s.id);
  if (lm && lm.from !== me && lm.at > (seen.msg || 0)) out.push('Nuovo messaggio');
  if (ms(s.start && s.start[o]) && !seen.start) out.push('Ha avviato il test');
  if (s.fb && s.fb[o] && !seen.fb) out.push('Ha lasciato il feedback');
  if (s.a === me && s.status === 'active' && !seen.acc) out.push('Ha accettato lo scambio');
  return out;
}
function syncWatch() {
  S.swaps.forEach((s, id) => {
    if (s.status !== 'active' || msgWatch.has(id)) return;
    let first = true;
    msgWatch.set(id, onSnapshot(query(collection(db, 'swaps', id, 'messages'), orderBy('at', 'desc'), limit(1)), sn => {
      const d = sn.docs[0] && read(sn.docs[0]);
      if (d) S.lastMsg.set(id, { at: d.at || 0, from: d.from });
      const open = S.route && S.route.t === 'swap' && S.route.id === id;
      if (!first && d && d.from !== me && !open) toast('Nuovo messaggio da ' + nameOf(d.from));
      first = false;
      if (open) markSeen(id);
      render();
    }, () => { /* senza permesso non c'è nulla da segnalare */ }));
  });
}
/* Scambi ancora aperti: richieste in attesa e scambi accettati non ancora completati da entrambi. */
const openSwaps = () => mine().filter(s => s.status !== 'declined' && !isDone(s));
/* done = tester dell'app attuale (i feedback senza app indicata contano); n e avg = tutti i feedback ricevuti. */
function stats(id) {
  const u = S.users.get(id); const cur = (u && u.app && u.app.name) || '';
  let n = 0, sum = 0, done = 0;
  S.fb.forEach(f => { if (f.to === id) { n++; sum += f.stars || 0; if (!f.app || f.app === cur) done++; } });
  return { done, n, avg: n ? sum / n : 0 };
}
function elapsed(s, uid) { const t = ms(s.start && s.start[uid]); return t ? (Date.now() - t) / DAY : null; }
const dayLabel = el => el === null ? 'Non avviato' : el >= 14 ? '14 giorni completati' : 'Giorno ' + (Math.floor(el) + 1) + ' di 14';
function tracker(el) { let h = '<div class="tracker" role="img" aria-label="' + esc(dayLabel(el)) + '">'; for (let i = 0; i < 14; i++) { let c = ''; if (el !== null) c = i < Math.floor(el) ? 'on' : (i === Math.floor(el) ? 'now' : ''); h += '<i class="' + c + '"></i>'; } return h + '</div>'; }
function meter(n) { let h = '<div class="meter" role="img" aria-label="' + n + ' tester su 12">'; for (let i = 0; i < 12; i++) h += '<i class="' + (i < n ? 'on' : '') + '"></i>'; return h + '</div>'; }
const rate = st => st.n ? '<span class="rate">★ ' + st.avg.toFixed(1) + ' · ' + st.n + '</span>' : '<span class="rate">Nessun feedback</span>';
const fmtD = t => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const fmtT = t => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const link = u => typeof u === 'string' && /^https:\/\//i.test(u) ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">Apri link di test</a>' : '';
function statusPill(s) { if (isDone(s)) return '<span class="pill ok">Completato</span>'; if (s.status === 'proposed') return '<span class="pill warn">' + (s.b === me ? 'Richiesta ricevuta' : 'In attesa') + '</span>'; return '<span class="pill">In corso</span>'; }
const stars = n => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));

/* ---------- Viste ---------- */
function exploreItems() {
  const q = S.q.trim().toLowerCase();
  const meU = S.users.get(me); const myApp = meU && meU.app && meU.app.name;
  const arr = []; let hidden = 0;
  S.users.forEach((u, id) => {
    if (id === me || !u.app || !u.app.name) return;
    if (q && (u.app.name + ' ' + (u.nick || '') + ' ' + (u.app.cat || '')).toLowerCase().indexOf(q) < 0) return;
    if (!compat(me, id) && !pairOpen(id)) { hidden++; return; }
    arr.push({ id, u, st: stats(id) });
  });
  arr.sort((a, b) => b.st.done - a.st.done || (b.u.createdAt || 0) - (a.u.createdAt || 0));
  const note = hidden ? '<p class="small muted">' + hidden + (hidden === 1 ? ' app nascosta perché non è' : ' app nascoste perché non sono') + ' compatibili con i paesi richiesti da te o da loro.</p>' : '';
  if (!arr.length) return '<div class="empty"><h3>Nessuna app da testare per ora</h3><p class="muted">' + (q ? 'Prova con un altro nome o categoria.' : 'Pubblica la tua app dal profilo e invita altri sviluppatori.') + '</p></div>' + note;
  return arr.map(x => {
    const ex = pairOpen(x.id); let act;
    if (!myApp || !countryOf(me)) act = '<button class="btn ghost" data-act="tab" data-tab="profile">Completa prima il tuo profilo</button>';
    else if (ex) act = '<button class="btn" data-act="swap" data-id="' + esc(ex.id) + '">Apri scambio</button>';
    else act = '<button class="btn primary" data-act="propose" data-id="' + esc(x.id) + '">Proponi scambio 1 a 1</button>';
    return '<article class="card"><div class="row between"><button class="who" data-act="user" data-id="' + esc(x.id) + '">' + av(x.id) + '<span class="n">' + esc(nameOf(x.id)) + '</span></button>' + rate(x.st) + '</div>'
      + '<div><h3 class="appname">' + esc(x.u.app.name) + '</h3><div class="row" style="margin-top:4px"><span class="chip">' + esc(x.u.app.cat || 'Altro') + '</span><span class="chip">' + esc(x.u.country || 'Paese n.d.') + '</span><span class="chip">Cerca: ' + esc(x.u.app.want || 'tutti i paesi') + '</span><span class="small muted">' + x.st.done + ' tester completati</span></div></div>'
      + (x.u.app.desc ? '<p class="desc">' + esc(x.u.app.desc) + '</p>' : '')
      + '<div>' + act + '</div></article>';
  }).join('') + note;
}
const exploreView = () => '<label for="q">Cerca un\'app<input id="q" type="search" value="' + esc(S.q) + '" placeholder="Nome, categoria o sviluppatore"></label><div id="list" class="stack">' + exploreItems() + '</div>';

function swapCard(s) {
  const o = s.a === me ? s.b : s.a; const el = elapsed(s, me);
  const oa = (s.apps && s.apps[o] && s.apps[o].name) || 'la sua app', ma = (s.apps && s.apps[me] && s.apps[me].name) || 'la tua app';
  let h = '<article class="card"><div class="row between"><button class="who" data-act="swap" data-id="' + esc(s.id) + '">' + av(o) + '<span class="n">' + esc(nameOf(o)) + '</span></button>' + statusPill(s) + '</div>'
    + '<p class="small"><b>Tu testi</b> ' + esc(oa) + ' · <b>lui testa</b> ' + esc(ma) + '</p>'
    + (unreadOf(s).length ? '<div class="row">' + unreadOf(s).map(l => '<span class="pill warn">' + l + '</span>').join('') + '</div>' : '');
  if (s.status === 'active' && !isDone(s)) h += tracker(el) + '<p class="small muted mono">' + esc(dayLabel(el)) + '</p>';
  if (s.status === 'proposed' && s.b === me) h += '<div class="row"><button class="btn primary" data-act="accept" data-id="' + esc(s.id) + '">Accetta</button><button class="btn ghost" data-act="decline" data-id="' + esc(s.id) + '">Rifiuta</button></div>';
  else h += '<div><button class="btn" data-act="swap" data-id="' + esc(s.id) + '">Apri</button></div>';
  return h + '</article>';
}
function swapsView() {
  const all = mine().filter(s => s.status !== 'declined');
  if (!all.length) return '<div class="empty"><h3>Nessuno scambio</h3><p class="muted">Scegli un\'app in Esplora e proponi uno scambio: tu testi la sua, lui testa la tua.</p><div><button class="btn primary" data-act="tab" data-tab="explore">Vai a Esplora</button></div></div>';
  const sec = (t, l) => l.length ? '<section class="stack"><h2>' + t + '</h2>' + l.map(swapCard).join('') + '</section>' : '';
  return sec('Richieste ricevute', all.filter(s => s.status === 'proposed' && s.b === me))
    + sec('In corso', all.filter(s => s.status === 'active' && !isDone(s)))
    + sec('Richieste inviate', all.filter(s => s.status === 'proposed' && s.a === me))
    + sec('Completati', all.filter(isDone));
}

function fbList(uid) {
  const a = []; S.fb.forEach(f => { if (f.to === uid) a.push(f); }); a.sort((x, y) => (y.at || 0) - (x.at || 0));
  if (!a.length) return '<p class="muted small">Nessun feedback ricevuto.</p>';
  return a.map(f => '<div class="fbitem"><div class="row between"><b>' + esc(nameOf(f.from)) + '</b><span class="small muted mono">' + fmtD(f.at || Date.now()) + '</span></div><span class="st" aria-label="' + f.stars + ' stelle su 5">' + stars(f.stars) + '</span>' + (f.text ? '<p class="desc">' + esc(f.text) + '</p>' : '') + '</div>').join('');
}
function statBlock(uid) {
  const st = stats(uid);
  return '<div class="card"><div class="row between"><h3>Tester completati</h3><span class="mono">' + Math.min(st.done, 12) + '/12</span></div>' + meter(Math.min(st.done, 12))
    + '<p class="small muted">Google Play chiede 12 tester per 14 giorni consecutivi. Conta ogni persona che ha testato la tua app per 14 giorni e ha lasciato il feedback.</p>'
    + '<div class="row between"><span class="small muted">Valutazione media</span>' + rate(st) + '</div></div>';
}
function profileView(uid, edit) {
  const u = S.users.get(uid) || {}; const ap = u.app || {};
  if (!edit) {
    return '<button class="btn ghost sm back" data-act="back">← Indietro</button>'
      + '<div class="card"><div class="row">' + av(uid) + '<div><h2>' + esc(nameOf(uid)) + '</h2><span class="chip">' + esc(u.country || 'Paese n.d.') + '</span></div></div>' + (u.bio ? '<p class="desc">' + esc(u.bio) + '</p>' : '') + '</div>'
      + (ap.name ? '<div class="card"><span class="small muted mono">APP DA TESTARE</span><h3 class="appname">' + esc(ap.name) + '</h3><div class="row"><span class="chip">' + esc(ap.cat || 'Altro') + '</span><span class="chip">Cerca: ' + esc(ap.want || 'tutti i paesi') + '</span></div>' + (ap.desc ? '<p class="desc">' + esc(ap.desc) + '</p>' : '') + '</div>' : '')
      + statBlock(uid) + '<section class="card"><h3>Feedback ricevuti</h3>' + fbList(uid) + '</section>';
  }
  const copts = (u.country ? '' : '<option value="">Scegli il tuo paese</option>') + COUNTRIES.map(c => '<option value="' + c + '"' + (u.country === c ? ' selected' : '') + '>' + c + '</option>').join('');
  const wopts = '<option value="">Qualsiasi paese</option>' + COUNTRIES.map(c => '<option value="' + c + '"' + (ap.want === c ? ' selected' : '') + '>Solo ' + c + '</option>').join('');
  const nOpen = openSwaps().length;
  const lock = nOpen > 0 && !!ap.name;
  const dis = lock ? ' disabled' : '';
  const lockNote = lock ? '<div class="banner">App bloccata: hai ' + nOpen + (nOpen === 1 ? ' scambio aperto' : ' scambi aperti') + '. Puoi cambiare app quando tutti gli scambi sono completati, rifiutati o chiusi. Li trovi in <b>Scambi</b>.</div>' : '';
  const opts = CATS.map(c => '<option' + ((ap.cat || 'Altro') === c ? ' selected' : '') + '>' + c + '</option>').join('');
  return (!S.users.get(me) ? '<div class="banner">Completa il profilo e pubblica la tua app per poter proporre scambi.</div>' : '')
    + '<form id="pf" class="card" autocomplete="off"><h2>Il tuo profilo</h2>'
    + '<label for="f-nick">Nome visibile<input id="f-nick" maxlength="30" value="' + esc(u.nick || '') + '" placeholder="Come ti chiamano gli altri"></label>'
    + '<label for="f-bio">Chi sei<textarea id="f-bio" maxlength="200" placeholder="Una riga su di te">' + esc(u.bio || '') + '</textarea><span class="field-note" id="c-f-bio">' + (u.bio || '').length + '/200</span></label>'
    + '<label for="f-email">Email dell\'account Google per i test<input id="f-email" type="email" inputmode="email" value="' + esc(S.priv.email || '') + '" placeholder="nome@gmail.com"><span class="field-note">Resta privata. Viene condivisa solo dentro uno scambio e solo se condividi anche tu.</span></label>'
    + '<label for="f-country">Il tuo paese<select id="f-country">' + copts + '</select><span class="field-note">Serve per far combaciare le richieste di tester. Lo scrivi tu, non viene verificato.</span></label>'
    + '<h2 style="margin-top:6px">La tua app</h2>' + lockNote
    + '<label for="f-app">Nome dell\'app<input id="f-app" maxlength="50"' + dis + ' value="' + esc(ap.name || '') + '"><span class="field-note" id="c-f-app">' + (ap.name || '').length + '/50</span></label>'
    + '<div class="grid2"><label for="f-cat">Categoria<select id="f-cat"' + dis + '>' + opts + '</select></label>'
    + '<label for="f-link">Link di adesione al test<input id="f-link" type="url" inputmode="url"' + dis + ' value="' + esc(S.priv.link || '') + '" placeholder="https://play.google.com/apps/testing/..."><span class="field-note">Resta privato: lo vede solo chi accetta uno scambio con te.</span></label></div>'
    + '<label for="f-want">Tester che ti servono<select id="f-want"' + dis + '>' + wopts + '</select><span class="field-note">Vedrai e potrai scambiare solo con chi è di quel paese e accetta il tuo.</span></label>'
    + '<label for="f-desc">Cosa deve provare il tester<textarea id="f-desc" maxlength="500"' + dis + ' placeholder="Cosa fa l\'app e cosa vorresti che controllasse">' + esc(ap.desc || '') + '</textarea><span class="field-note" id="c-f-desc">' + (ap.desc || '').length + '/500</span></label>'
    + '<div><button class="btn primary" type="submit">Salva profilo</button></div></form>'
    + statBlock(uid) + '<section class="card"><h3>Feedback ricevuti</h3>' + fbList(uid) + '</section>';
}

function swapView(id) {
  const s = S.swaps.get(id) && Object.assign({ id }, S.swaps.get(id));
  const back = '<button class="btn ghost sm back" data-act="back">← Indietro</button>';
  if (!s) return back + '<div class="empty"><h3>Scambio non trovato</h3></div>';
  const o = s.a === me ? s.b : s.a;
  const oApp = (s.apps && s.apps[o]) || {}, mApp = (s.apps && s.apps[me]) || {};
  let h = back + '<div class="card"><div class="row between"><button class="who" data-act="user" data-id="' + esc(o) + '">' + av(o) + '<span class="n">' + esc(nameOf(o)) + '</span></button>' + statusPill(s) + '</div>'
    + '<div class="box"><span class="small muted mono">TU TESTI</span><b>' + esc(oApp.name || 'App') + '</b>'
    + (s.status === 'active' ? (S.theirLink ? link(S.theirLink) : '<span class="small muted">Il link di test non è disponibile.</span>') : '<span class="small muted">Il link di test si sblocca quando lo scambio viene accettato.</span>') + '</div>'
    + '<div class="box"><span class="small muted mono">LUI TESTA</span><b>' + esc(mApp.name || 'La tua app') + '</b></div></div>';
  if (s.status === 'proposed') {
    if (s.b === me) return h + '<div class="card"><p>' + esc(nameOf(o)) + ' propone di testarsi a vicenda.</p><div class="row"><button class="btn primary" data-act="accept" data-id="' + esc(id) + '">Accetta</button><button class="btn ghost" data-act="decline" data-id="' + esc(id) + '">Rifiuta</button></div></div>';
    return h + '<div class="card"><p>Richiesta inviata. Quando ' + esc(nameOf(o)) + ' accetta si apre la chat.</p><div><button class="btn ghost" data-act="decline" data-id="' + esc(id) + '">Annulla richiesta</button></div></div>';
  }
  const done = isDone(s);
  const mineE = S.myEmail, theirE = S.theirEmail;
  let step1 = '<div class="step"><h3><span class="k">1</span>Scambio delle email</h3>';
  if (mineE && theirE) {
    step1 += '<div class="box"><div class="mail"><span class="small muted">La tua</span><code>' + esc(mineE) + '</code></div><div class="mail"><span class="small muted">La sua</span><code>' + esc(theirE) + '</code><button class="btn sm" data-act="copy" data-text="' + esc(theirE) + '">Copia</button></div></div><p class="small muted">Aggiungi la sua email tra i tester della tua app in Play Console e usa il suo link per entrare nel test.</p>';
  } else {
    step1 += '<p class="small muted">' + (mineE ? 'Hai condiviso la tua email. Aspetta che lo faccia anche ' + esc(nameOf(o)) + ' per vedere la sua.' : 'Le email si vedono solo quando le condividete entrambi. La sua si sblocca dopo che hai condiviso la tua.') + '</p>';
    if (!mineE) step1 += S.priv.email ? '<div><button class="btn primary" data-act="shareEmail" data-id="' + esc(id) + '">Condividi la mia email</button></div>' : '<div><button class="btn" data-act="tab" data-tab="profile">Aggiungi la tua email nel profilo</button></div>';
  }
  step1 += '</div>';
  const el = elapsed(s, me), oel = elapsed(s, o);
  let step2 = '<div class="step"><h3><span class="k">2</span>Test di 14 giorni</h3>'
    + '<div class="stack" style="gap:6px"><div class="row between"><b class="small">Tu su ' + esc(oApp.name || 'la sua app') + '</b><span class="small mono muted">' + esc(dayLabel(el)) + '</span></div>' + tracker(el) + '</div>'
    + '<div class="stack" style="gap:6px"><div class="row between"><b class="small">Lui su ' + esc(mApp.name || 'la tua app') + '</b><span class="small mono muted">' + esc(dayLabel(oel)) + '</span></div>' + tracker(oel) + '</div>';
  if (el === null) step2 += S.theirLink
    ? '<div><button class="btn primary" data-act="startTest" data-id="' + esc(id) + '">Ho installato l\'app, avvia i 14 giorni</button></div>'
    : '<p class="small muted">Potrai avviare il test quando avrai il link dell\'app da installare.</p>';
  step2 += '</div>';
  let step3 = '<div class="step"><h3><span class="k">3</span>Feedback reciproco</h3>';
  if (s.fb && s.fb[me]) step3 += '<p class="small">Hai inviato il tuo feedback. ' + (done ? 'Scambio completato: conta come un tester per entrambi.' : 'Aspetto quello di ' + esc(nameOf(o)) + '.') + '</p>';
  else if (el !== null && el >= TEST_DAYS) {
    const n = S.star[id] || 0;
    step3 += '<p class="small muted">Come ha lavorato ' + esc(nameOf(o)) + ' durante lo scambio?</p><div class="stars" role="group" aria-label="Valutazione">' + [1, 2, 3, 4, 5].map(i => '<button type="button" class="star' + (i <= n ? ' on' : '') + '" data-act="star" data-id="' + esc(id) + '" data-n="' + i + '" aria-label="' + i + ' stelle">★</button>').join('') + '</div>'
      + '<label for="fbtext">Commento<textarea id="fbtext" maxlength="600" placeholder="Puntualità, qualità delle segnalazioni, comunicazione"></textarea></label><div><button class="btn primary" data-act="fb" data-id="' + esc(id) + '">Invia feedback</button></div>';
  } else step3 += '<p class="small muted">Si sblocca dopo 14 giorni di test' + (el === null ? '. Avvia il tuo test per far partire il conteggio.' : ': mancano ' + Math.max(1, Math.ceil(14 - el)) + ' giorni.') + '</p>';
  const rf = S.fb.get(id + '_' + o);
  if (rf) step3 += '<div class="fbitem"><b class="small">Feedback di ' + esc(nameOf(o)) + '</b><span class="st">' + stars(rf.stars) + '</span>' + (rf.text ? '<p class="desc">' + esc(rf.text) + '</p>' : '') + '</div>';
  step3 += '</div>';
  const chat = '<div class="step"><h3>Chat</h3><div class="chat"><div id="msgs"></div><form id="cf" class="send" autocomplete="off"><input id="msg" maxlength="200" placeholder="Scrivi a ' + esc(nameOf(o)) + ' (max 200 caratteri)" aria-label="Messaggio, massimo 200 caratteri"><button class="btn primary" type="submit">Invia</button></form></div></div>';
  const closeBox = done ? '' : '<div class="card"><p class="small muted">Se l\'altro non risponde più puoi chiudere lo scambio. La tua app si libera e potrai cambiarla.</p>'
    + (S.confirm === id
      ? '<div class="row"><button class="btn primary" data-act="decline" data-id="' + esc(id) + '">Conferma: chiudi scambio</button><button class="btn ghost" data-act="noClose">Non chiudere</button></div>'
      : '<div><button class="btn ghost" data-act="askClose" data-id="' + esc(id) + '">Chiudi scambio</button></div>') + '</div>';
  return h + '<div class="card">' + step1 + step2 + step3 + chat + '</div>' + closeBox;
}

function authErr(x) {
  const m = {
    'auth/invalid-email': 'L\'email non è valida.',
    'auth/missing-password': 'Scrivi la password.',
    'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
    'auth/email-already-in-use': 'Esiste già un account con questa email. Usa Accedi.',
    'auth/invalid-credential': 'Email o password sbagliate.',
    'auth/wrong-password': 'Email o password sbagliate.',
    'auth/user-not-found': 'Email o password sbagliate.',
    'auth/too-many-requests': 'Troppi tentativi. Aspetta qualche minuto e riprova.',
    'auth/operation-not-allowed': 'Accesso con email non attivo: abilitalo in Firebase > Authentication.',
    'auth/network-request-failed': 'Connessione assente. Riprova.'
  };
  toast(m[x && x.code] || 'Accesso non riuscito. Riprova.');
  console.error(x);
}
const loginForm = '<div class="stack" style="width:100%"><img class="logo-big" src="logo.png" width="112" height="112" alt="Blinders Test App"><div><button class="btn primary" data-act="login">Accedi con Google</button></div>'
  + '<p class="small muted">oppure con email e password</p>'
  + '<form id="af" class="stack" autocomplete="on" novalidate>'
  + '<label for="a-email">Email<input id="a-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="nome@esempio.it"></label>'
  + '<label for="a-pass">Password<input id="a-pass" name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Almeno 6 caratteri"></label>'
  + '<div class="row"><button class="btn primary" type="submit" data-mode="signin">Accedi</button><button class="btn" type="submit" data-mode="signup">Registrati</button></div>'
  + '<div><button class="btn ghost sm" type="button" data-act="reset">Password dimenticata</button></div></form></div>';
function gate(t, p, extra) { view.innerHTML = '<div class="empty login"><h3>' + t + '</h3><p class="muted">' + p + '</p>' + (extra || '') + '</div>'; $('#nav').hidden = true; $('#out').hidden = !me; }

/* ---------- Render ---------- */
function render(force) {
  if (!force) { const a = document.activeElement; if (a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { dirty = true; return; } }
  dirty = false;
  if (!me) return gate('Accedi per iniziare', 'Crei il profilo, proponi scambi e chatti con gli altri sviluppatori. Se è la prima volta con email e password, tocca Registrati.', loginForm);
  if (!(loaded.users && loaded.swaps && loaded.fb && loaded.priv)) return;
  if (!firstRoute) { firstRoute = true; if (!S.users.get(me)) S.tab = 'profile'; }
  if (S.route && S.route.t === 'swap') markSeen(S.route.id);
  syncWatch();
  const rec = mine().filter(s => (s.status === 'proposed' && s.b === me) || (s.status !== 'declined' && unreadOf(s).length)).length;
  document.title = (rec ? '(' + rec + ') ' : '') + 'Blinders Test App';
  $('#navin').innerHTML = [['explore', 'Esplora'], ['swaps', 'Scambi'], ['profile', 'Profilo']].map(t => '<button class="navb' + (S.tab === t[0] && !S.route ? ' on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + (t[0] === 'swaps' && rec ? '<span class="dot">' + rec + '</span>' : '') + '</button>').join('');
  $('#nav').hidden = false; $('#out').hidden = false;
  let h = '';
  if (S.route && S.route.t === 'user') h += S.route.id === me ? profileView(me, true) : profileView(S.route.id, false);
  else if (S.route && S.route.t === 'swap') h += swapView(S.route.id);
  else if (S.tab === 'explore') h += exploreView();
  else if (S.tab === 'swaps') h += swapsView();
  else h += profileView(me, true);
  view.innerHTML = h;
  syncSubs(); drawMsgs();
}

/* ---------- Sottoscrizioni dello scambio aperto (chat, email) ---------- */
function stopSubs() { subUnsubs.forEach(u => u()); subUnsubs = []; subKey = ''; msgs = []; S.myEmail = undefined; S.theirEmail = undefined; S.theirLink = undefined; }
function syncSubs() {
  let id = null, o = null;
  if (me && S.route && S.route.t === 'swap') {
    const s = S.swaps.get(S.route.id);
    if (s && s.status === 'active') { id = S.route.id; o = s.a === me ? s.b : s.a; }
  }
  if (!id) { if (subKey) stopSubs(); return; }
  if (subKey === id) return;
  stopSubs(); subKey = id;
  subUnsubs.push(onSnapshot(query(collection(db, 'swaps', id, 'messages'), orderBy('at', 'asc'), limit(200)), sn => { msgs = sn.docs.map(read); drawMsgs(); }, toastErr));
  // Il link di test dell'altro è leggibile solo a scambio accettato (regola di Firestore).
  subUnsubs.push(onSnapshot(doc(db, 'swaps', id, 'links', o), sn => { S.theirLink = sn.exists() ? sn.data().link : null; render(); }, () => { S.theirLink = null; }));
  let theirUnsub = null;
  subUnsubs.push(onSnapshot(doc(db, 'swaps', id, 'emails', me), sn => {
    S.myEmail = sn.exists() ? sn.data().email : null;
    if (S.myEmail && !theirUnsub) {
      // La sua email si può leggere solo dopo aver condiviso la tua (regola di Firestore).
      theirUnsub = onSnapshot(doc(db, 'swaps', id, 'emails', o), s2 => { S.theirEmail = s2.exists() ? s2.data().email : null; render(); }, () => { S.theirEmail = null; });
      subUnsubs.push(() => theirUnsub());
    }
    render();
  }, () => { S.myEmail = null; }));
}
function drawMsgs() {
  const el = $('#msgs'); if (!el) return;
  el.innerHTML = msgs.length ? msgs.map(m => '<div class="msg' + (m.from === me ? ' me' : '') + '"><p>' + esc(m.text) + '</p><time>' + fmtT(m.at || Date.now()) + '</time></div>').join('') : '<p class="muted small">Nessun messaggio. Presentati e concorda come procedere.</p>';
  el.scrollTop = el.scrollHeight;
}

/* ---------- Azioni ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b || busy) return;
  const act = b.dataset.act, id = b.dataset.id;
  try {
    if (act === 'login') { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (x) { if (x.code !== 'auth/popup-closed-by-user' && x.code !== 'auth/cancelled-popup-request') toast(x.code === 'auth/unauthorized-domain' ? 'Dominio non autorizzato: aggiungilo in Firebase > Authentication > Impostazioni.' : 'Accesso non riuscito. Riprova.'); } return; }
    if (act === 'logout') { await signOut(auth); return; }
    if (act === 'reset') {
      const em = (($('#a-email') || {}).value || '').trim();
      if (!em) { toast('Scrivi prima la tua email.'); return; }
      try { await sendPasswordResetEmail(auth, em); toast('Ti ho inviato un\'email per scegliere una nuova password.'); } catch (x) { authErr(x); }
      return;
    }
    if (act === 'tab') { S.tab = b.dataset.tab; S.route = null; render(true); window.scrollTo(0, 0); return; }
    if (act === 'user') { S.route = { t: 'user', id }; render(true); window.scrollTo(0, 0); return; }
    if (act === 'swap') { S.route = { t: 'swap', id }; render(true); window.scrollTo(0, 0); return; }
    if (act === 'back') { S.route = null; S.confirm = null; render(true); return; }
    if (act === 'askClose') { S.confirm = id; render(true); return; }
    if (act === 'noClose') { S.confirm = null; render(true); return; }
    if (act === 'star') { S.star[id] = +b.dataset.n; view.querySelectorAll('.star').forEach((x, i) => x.classList.toggle('on', i < S.star[id])); return; }
    if (act === 'copy') { try { await navigator.clipboard.writeText(b.dataset.text); toast('Email copiata'); } catch (x) { toast('Copia non disponibile: seleziona il testo a mano'); } return; }
    busy = true; b.disabled = true;
    const s = S.swaps.get(id);
    if (act === 'propose') {
      const meU = S.users.get(me), them = S.users.get(id);
      if (!meU || !meU.app || !meU.app.name) { toast('Pubblica prima la tua app nel profilo.'); return; }
      if (!them || !them.app || !them.app.name) return;
      if (pairOpen(id)) { toast('Avete già uno scambio aperto.'); return; }
      if (!countryOf(me)) { toast('Scegli prima il tuo paese nel profilo.'); return; }
      if (!compat(me, id)) { toast('Scambio non compatibile con i paesi richiesti.'); return; }
      if (!S.priv.link) { toast('Aggiungi nel profilo il link di adesione al test della tua app.'); return; }
      const apps = {}; apps[me] = { name: meU.app.name }; apps[id] = { name: them.app.name };
      const ref = await addDoc(collection(db, 'swaps'), { a: me, b: id, members: [me, id], apps, status: 'proposed', createdAt: Date.now(), start: {}, fb: {} });
      await setDoc(doc(db, 'swaps', ref.id, 'links', me), { link: S.priv.link });
      toast('Richiesta inviata'); S.tab = 'swaps'; S.route = { t: 'swap', id: ref.id };
    } else if (act === 'accept') {
      const oo = s.a === me ? s.b : s.a;
      if (!compat(me, oo)) { toast('Scambio non compatibile con i paesi richiesti.'); return; }
      if (!S.priv.link) { toast('Aggiungi nel profilo il link di adesione al test della tua app, poi accetta.'); return; }
      const ab = writeBatch(db);
      ab.set(doc(db, 'swaps', id, 'links', me), { link: S.priv.link });
      ab.update(doc(db, 'swaps', id), { status: 'active', acceptedAt: Date.now() });
      await ab.commit(); toast('Scambio accettato');
    } else if (act === 'decline') { await updateDoc(doc(db, 'swaps', id), { status: 'declined' }); S.route = null; S.confirm = null; toast(s.status === 'active' ? 'Scambio chiuso' : (s.a === me ? 'Richiesta annullata' : 'Richiesta rifiutata')); }
    else if (act === 'shareEmail') {
      if (!S.priv.email) { toast('Aggiungi la tua email nel profilo.'); return; }
      await setDoc(doc(db, 'swaps', id, 'emails', me), { email: S.priv.email, at: Date.now() }); toast('Email condivisa');
    } else if (act === 'startTest') {
      if (!S.theirLink) { toast('Prima ti serve il link dell\'app da installare.'); return; }
      await updateDoc(doc(db, 'swaps', id), { ['start.' + me]: serverTimestamp() }); toast('Test avviato'); }
    else if (act === 'fb') {
      const n = S.star[id] || 0; if (!n) { toast('Scegli da 1 a 5 stelle.'); return; }
      const o = s.a === me ? s.b : s.a; const tx = (($('#fbtext') || {}).value || '').trim().slice(0, 600);
      const batch = writeBatch(db);
      batch.set(doc(db, 'feedback', id + '_' + me), { swapId: id, from: me, to: o, stars: n, text: tx, app: (s.apps && s.apps[o] && s.apps[o].name) || '', at: Date.now() });
      batch.update(doc(db, 'swaps', id), { ['fb.' + me]: true });
      await batch.commit(); toast('Feedback inviato');
    }
  } catch (err) { toastErr(err); }
  finally { busy = false; if (me) render(true); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { S.q = e.target.value; const l = $('#list'); if (l) l.innerHTML = exploreItems(); }
  const c = e.target.id && $('#c-' + e.target.id); if (c) c.textContent = e.target.value.length + '/' + e.target.maxLength;
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'af') {
    if (busy) return;
    const mode = (e.submitter && e.submitter.dataset.mode) || 'signin';
    const em = $('#a-email').value.trim(), pw = $('#a-pass').value;
    if (!em) { toast('Scrivi la tua email.'); return; }
    if (!pw) { toast('Scrivi la password.'); return; }
    busy = true;
    try {
      if (mode === 'signup') await createUserWithEmailAndPassword(auth, em, pw);
      else await signInWithEmailAndPassword(auth, em, pw);
    } catch (x) { authErr(x); } finally { busy = false; }
    return;
  }
  if (busy || !me) return;
  if (e.target.id === 'cf') {
    const inp = $('#msg'); const t = inp.value.trim(); if (!t || !subKey) return; inp.value = '';
    try { await addDoc(collection(db, 'swaps', subKey, 'messages'), { from: me, text: t.slice(0, 200), at: Date.now() }); } catch (err) { inp.value = t; toastErr(err); }
    return;
  }
  if (e.target.id === 'pf') {
    const nick = $('#f-nick').value.trim(), email = $('#f-email').value.trim(), ap = $('#f-app').value.trim().slice(0, 50), lk = $('#f-link').value.trim();
    if (!nick) { toast('Scrivi il nome visibile.'); return; }
    const country = $('#f-country').value; if (!country) { toast('Scegli il tuo paese.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Controlla l\'email.'); return; }
    if (lk && !/^https:\/\//i.test(lk)) { toast('Il link deve iniziare con https://'); return; }
    busy = true;
    try {
      const old = S.users.get(me) || {};
      // Con scambi aperti l'app non si cambia: si riscrive quella già salvata.
      const locked = openSwaps().length > 0 && !!(old.app && old.app.name);
      const keep = Object.assign({}, old.app || {}); delete keep.link;
      await setDoc(doc(db, 'users', me), { nick, country, bio: $('#f-bio').value.trim().slice(0, 200), app: locked ? keep : { name: ap, want: $('#f-want').value, cat: $('#f-cat').value, desc: $('#f-desc').value.trim().slice(0, 500) }, createdAt: old.createdAt || Date.now(), updatedAt: Date.now() });
      await setDoc(doc(db, 'userPrivate', me), { email, link: locked ? (S.priv.link || '') : lk });
      toast(ap ? 'Profilo salvato' : 'Profilo salvato. Aggiungi la tua app per comparire in Esplora.');
    } catch (err) { toastErr(err); } finally { busy = false; render(true); }
  }
});
document.addEventListener('focusout', () => { setTimeout(() => { if (dirty) { const a = document.activeElement; if (!(a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render(); } }, 700); });

/* ---------- Avvio ---------- */
function startData() {
  const upd = (key, map) => sn => { S[map] = new Map(sn.docs.map(d => [d.id, read(d)])); loaded[key] = true; render(); };
  dataUnsubs.push(onSnapshot(collection(db, 'users'), upd('users', 'users'), toastErr));
  dataUnsubs.push(onSnapshot(query(collection(db, 'swaps'), where('members', 'array-contains', me)), sn => {
    const next = new Map(sn.docs.map(d => [d.id, read(d)]));
    if (loaded.swaps) {
      next.forEach((s, id) => {
        const old = S.swaps.get(id); const o = s.a === me ? s.b : s.a;
        if (!old) { if (s.b === me && s.status === 'proposed') toast(nameOf(s.a) + ' ti ha proposto uno scambio'); return; }
        if (S.route && S.route.t === 'swap' && S.route.id === id) return;
        if (old.status === 'proposed' && s.status === 'active' && s.a === me) toast(nameOf(o) + ' ha accettato lo scambio');
        if (!ms(old.start && old.start[o]) && ms(s.start && s.start[o])) toast(nameOf(o) + ' ha avviato il test');
        if (!(old.fb && old.fb[o]) && s.fb && s.fb[o]) toast(nameOf(o) + ' ha lasciato il feedback');
      });
    }
    S.swaps = next; loaded.swaps = true; render();
  }, toastErr));
  dataUnsubs.push(onSnapshot(collection(db, 'feedback'), upd('fb', 'fb'), toastErr));
  dataUnsubs.push(onSnapshot(doc(db, 'userPrivate', me), sn => { S.priv = sn.exists() ? sn.data() : { email: '' }; loaded.priv = true; render(); }, toastErr));
}
function stopData() { dataUnsubs.forEach(u => u()); dataUnsubs = []; msgWatch.forEach(u => u()); msgWatch.clear(); S.lastMsg = new Map(); stopSubs(); S.users = new Map(); S.swaps = new Map(); S.fb = new Map(); S.priv = { email: '' }; Object.keys(loaded).forEach(k => { loaded[k] = false; }); firstRoute = false; S.route = null; S.tab = 'explore'; }

if (!firebaseConfig.apiKey || /INCOLLA/.test(firebaseConfig.apiKey)) {
  gate('Manca la configurazione di Firebase', 'Apri il file firebase-config.js e incolla i valori del tuo progetto Firebase. I passaggi sono nel README.');
} else {
  app = initializeApp(firebaseConfig); auth = getAuth(app); /* Su molte reti mobili la connessione in tempo reale resta bloccata e gli aggiornamenti non arrivano.
     Con il rilevamento automatico Firestore passa da solo a una connessione più compatibile. */
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  onAuthStateChanged(auth, u => {
    stopData(); me = u ? u.uid : null;
    if (me) startData();
    render(true);
  });
}
