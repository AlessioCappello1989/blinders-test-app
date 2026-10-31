import { firebaseConfig, TEST_DAYS } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, collection, doc, setDoc, updateDoc, addDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch, deleteDoc, getDocs, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
const CATS = ['Giochi', 'Produttività', 'Social', 'Strumenti', 'Salute e fitness', 'Istruzione', 'Finanza', 'Altro'];
const COUNTRIES = ['Italia', 'Albania', 'Argentina', 'Australia', 'Austria', 'Belgio', 'Brasile', 'Canada', 'Cina', 'Croazia', 'Danimarca', 'Egitto', 'Filippine', 'Finlandia', 'Francia', 'Germania', 'Giappone', 'Grecia', 'India', 'Indonesia', 'Irlanda', 'Messico', 'Paesi Bassi', 'Polonia', 'Portogallo', 'Regno Unito', 'Romania', 'Spagna', 'Stati Uniti', 'Svezia', 'Svizzera', 'Turchia', 'Ucraina', 'Altro'];

const view = $('#view');
const S = { tab: 'explore', route: null, users: new Map(), swaps: new Map(), fb: new Map(), refs: new Map(), myRef: undefined, priv: { email: '' }, paid: 0, slotReq: undefined, reqs: new Map(), q: '', fc: '', star: {}, pick: {}, myEmail: undefined, theirEmail: undefined };
/* Invito di un amico: il link ?invito=ID viene ricordato su questo dispositivo fino alla registrazione. */
const INVITE_KEY = 'blinders-invite';
let pendingInvite = null;
try {
  const ip = new URLSearchParams(location.search).get('invito');
  const iok = ip && /^[A-Za-z0-9_-]{6,128}$/.test(ip) ? ip : null;
  if (iok) { try { localStorage.setItem(INVITE_KEY, iok); } catch (e) { /* vale solo per questa visita */ } }
  if (ip !== null) history.replaceState(null, '', location.pathname + location.hash);
  pendingInvite = iok || localStorage.getItem(INVITE_KEY);
} catch (e) { /* senza memoria locale l'invito vale solo per questa visita */ }
function clearInvite() { pendingInvite = null; try { localStorage.removeItem(INVITE_KEY); } catch (e) { /* nessuna memoria locale */ } }
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
/* App di uno sviluppatore: quella principale ('main') più le app extra sbloccate con gli inviti ('x1'..'x3'). */
const SLOTS = ['x1', 'x2', 'x3'];
const MAX_EXTRA = 3;
/* Offerta libera: scrivi qui il tuo nome PayPal.me (per esempio 'mariorossi' da paypal.me/mariorossi). Se è vuoto i pulsanti non compaiono. */
const PAYPAL_ME = 'AlessioCappello89';
const ADMIN_EMAIL = 'alessiocappello1989@gmail.com';
const SLOT_PRICE = '1,99 €';
const MOON_COST = 20;
const payUrl = () => 'https://www.paypal.me/' + encodeURIComponent(PAYPAL_ME) + '/1.99EUR';
const tipUrl = () => 'https://www.paypal.me/' + encodeURIComponent(PAYPAL_ME);
const appsOf = id => {
  const u = S.users.get(id); const l = [];
  if (u && u.app && u.app.name) l.push(Object.assign({ id: 'main' }, u.app));
  if (u && u.extra) SLOTS.forEach(k => { if (u.extra[k] && u.extra[k].name) l.push(Object.assign({ id: k }, u.extra[k])); });
  return l;
};
const appOf = (uid, aid) => appsOf(uid).find(x => x.id === (aid || 'main'));
const wantOf = (uid, aid) => { const a = appOf(uid, aid); return (a && a.want) || ''; };
const canTest = (tester, owner, oAid) => { const w = wantOf(owner, oAid); return !w || w === countryOf(tester); };
const compat = (a, aA, b, bA) => canTest(a, b, bA) && canTest(b, a, aA);
/* Etichetta e classe che distinguono le app extra dalla principale. */
const isExtra = aid => !!aid && aid !== 'main';
const xcls = aid => isExtra(aid) ? ' extra' : '';
const xtag = aid => isExtra(aid) ? '<span class="pill ok">🧩 App extra</span>' : '';
const aidOf = (s, uid) => (s.appIds && s.appIds[uid]) || 'main';
function mine() { const a = []; S.swaps.forEach((s, id) => a.push(Object.assign({ id }, s))); return a.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)); }
const isOpenSwap = s => s.status !== 'declined' && !isDone(s);
function pairOpen(o, mA, oA) { return mine().find(s => members(s).indexOf(o) > -1 && aidOf(s, me) === mA && aidOf(s, o) === oA && isOpenSwap(s)); }
/* Scambio ancora aperto con quell'app dell'altro, qualunque sia la mia. */
const swapForCard = (o, oA) => mine().find(s => members(s).indexOf(o) > -1 && aidOf(s, o) === oA && isOpenSwap(s));
const openCount = aid => mine().filter(s => isOpenSwap(s) && aidOf(s, me) === aid).length;
const linkFor = aid => aid === 'main' ? (S.priv.link || '') : ((S.priv.extraLinks || {})[aid] || '');
/* Inviti: un amico conta quando si è registrato con il tuo link, ha il profilo e ha pubblicato la sua app. Massimo 3 extra. */
function validInvites() {
  const u = S.users.get(me); const spent = (u && u.spent) || [];
  const out = []; S.refs.forEach((r, inv) => { const f = S.users.get(inv); if (f && f.app && f.app.name && spent.indexOf(inv) < 0) out.push([inv, (r && r.at) || 0]); });
  return out.sort((x, y) => x[1] - y[1]).map(x => x[0]).slice(0, MAX_EXTRA);
}
const inviteLink = () => location.origin + location.pathname + '?invito=' + encodeURIComponent(me);
const hasExtra = (u, k) => !!(u && u.extra && u.extra[k] && u.extra[k].name);
const paidSlots = () => Math.max(0, Math.min(MAX_EXTRA, Math.floor(+S.paid || 0)));
const extraCount = u => SLOTS.filter(k => hasExtra(u, k)).length;
/* Lune: +1 per ogni giorno di test completato (massimo 14 per scambio). Il valore più alto raggiunto si salva nel profilo. */
function moonsEarned() {
  let n = 0;
  mine().forEach(sw => { if (sw.status === 'declined') return; const el = elapsed(sw, me); if (el !== null) n += Math.min(14, Math.floor(el)); });
  return n;
}
const moonTotal = u => Math.max((u && u.moons) || 0, moonsEarned());
const moonBalance = u => Math.max(0, moonTotal(u) - ((u && u.moonsSpent) || 0));
const moonSlots = u => Math.floor(((u && u.moonsSpent) || 0) / MOON_COST);
const markers = u => ((u && u.spent) || []).filter(x => x === '#').length;
/* Slot extra = inviti non usati + slot ottenuti con le Lune o pagati, meno quelli già consumati (massimo 3 app extra). */
const otherCredits = u => Math.max(0, moonSlots(u) + paidSlots() - markers(u));
const creditsTotal = u => Math.min(MAX_EXTRA, validInvites().length + otherCredits(u));
const freeSlots = u => Math.max(0, creditsTotal(u) - extraCount(u));
const moonLabel = n => '🌕 ' + n + (n === 1 ? ' Luna' : ' Lune');
let moonWrite = false;
/* Test in corso di una persona: scambi attivi in cui ha avviato il test e non ha ancora lasciato il feedback. */
const myTesting = () => mine().filter(sw => sw.status === 'active' && ms(sw.start && sw.start[me]) && !(sw.fb && sw.fb[me])).length;
/* Salva nel profilo le Lune guadagnate e i test in corso, così si possono contare anche per la community. */
function syncMoons() {
  const u = S.users.get(me); if (!u || moonWrite || busy) return;
  const patch = {}; const t = moonsEarned(); if (t > (u.moons || 0)) patch.moons = t;
  const n = Math.min(100, myTesting()); if (n !== (u.testing || 0)) patch.testing = n;
  if (!Object.keys(patch).length) return;
  moonWrite = true;
  updateDoc(doc(db, 'users', me), patch).catch(e => console.error(e)).finally(() => { moonWrite = false; });
}
const slotsShown = u => { let free = freeSlots(u); return SLOTS.filter(k => { if (hasExtra(u, k)) return true; if (free > 0) { free--; return true; } return false; }); };
async function recordInvite(old, hasApp) {
  if (!pendingInvite || !hasApp) return false;
  if (S.myRef || pendingInvite === me || !S.users.get(pendingInvite)) { clearInvite(); return false; }
  if (old.createdAt && Date.now() - old.createdAt > 7 * DAY) { clearInvite(); return false; }
  try { await setDoc(doc(db, 'refs', me), { by: pendingInvite, at: Date.now() }); clearInvite(); return true; } catch (e) { console.error(e); return false; }
}
/* ---------- Novità non lette (salvate su questo dispositivo) ---------- */
const seenKey = () => 'blinders-seen-' + me;
function getSeen() { try { return JSON.parse(localStorage.getItem(seenKey()) || '{}'); } catch (e) { return {}; } }
function markSeen(id) {
  if (!S.swaps.get(id)) return;
  const all = getSeen(); const lm = S.lastMsg.get(id);
  all[id] = { msg: Math.max(lm ? lm.at : 0, Date.now()), start: true, fb: true, acc: true };
  try { localStorage.setItem(seenKey(), JSON.stringify(all)); } catch (e) { /* senza memoria locale gli avvisi restano finché non cambia lo stato */ }
}
function unreadInfo(s) {
  const seen = getSeen()[s.id] || {}; const o = s.a === me ? s.b : s.a; const out = []; const lm = S.lastMsg.get(s.id);
  const nMsg = lm ? lm.list.filter(m => m.from !== me && m.at > (seen.msg || 0)).length : 0;
  if (nMsg) out.push(nMsg === 1 ? 'Nuovo messaggio' : nMsg + ' nuovi messaggi');
  if (ms(s.start && s.start[o]) && !seen.start) out.push('Ha avviato il test');
  if (s.fb && s.fb[o] && !seen.fb) out.push('Ha lasciato il feedback');
  if (s.a === me && s.status === 'active' && !seen.acc) out.push('Ha accettato lo scambio');
  return { labels: out, n: out.length + Math.max(0, nMsg - 1) };
}
const unreadOf = s => unreadInfo(s).labels;
function syncWatch() {
  S.swaps.forEach((s, id) => {
    if (s.status !== 'active' || msgWatch.has(id)) return;
    let first = true;
    msgWatch.set(id, onSnapshot(query(collection(db, 'swaps', id, 'messages'), orderBy('at', 'desc'), limit(30)), sn => {
      const list = sn.docs.map(read); const d = list[0];
      if (d) S.lastMsg.set(id, { at: d.at || 0, from: d.from, list: list.map(m => ({ at: m.at || 0, from: m.from })) });
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
/* done = tester di quell'app (per la principale contano anche i feedback senza app indicata); n e avg = tutti i feedback ricevuti. */
function stats(id, a) {
  const cur = a || appsOf(id)[0] || { id: 'main', name: '' };
  let n = 0, sum = 0, done = 0;
  S.fb.forEach(f => { if (f.to === id) { n++; sum += f.stars || 0; if (f.app ? f.app === cur.name : cur.id === 'main') done++; } });
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
function inviteBox(short) {
  if (!S.users.get(me)) return '';
  const n = validInvites().length;
  const prog = '<span class="pill ' + (n ? 'ok' : '') + '">' + n + '/' + MAX_EXTRA + ' amici</span>';
  if (short) return '<div class="card"><div class="row between"><b>Vuoi far testare un\'altra app?</b>' + prog + '</div><p class="small muted">Invita un amico: quando si registra e pubblica la sua app sblocchi un\'app extra, anche se la precedente è in fase di test.</p><div><button class="btn" data-act="invite">Invita un amico</button></div></div>';
  return '<div class="card"><div class="row between"><h2>Invita un amico</h2>' + prog + '</div>'
    + '<p class="small muted">Ogni amico che si registra con il tuo link e pubblica la sua app ti sblocca uno spazio per un\'app extra da far testare, anche se la precedente è in fase di test. Massimo ' + MAX_EXTRA + ' app extra.</p>'
    + '<div class="row"><button class="btn primary" data-act="invite">Invita un amico</button><button class="btn" data-act="copy" data-text="' + esc(inviteLink()) + '" data-msg="Link copiato!">Copia link</button></div>'
    + '<p class="small muted">Inviti disponibili: ' + n + '. Gli amici contano quando hanno pubblicato la loro app. Quando concludi un\'app extra lo slot si azzera e per riaverlo serve invitare un altro amico.</p></div>';
}
function exploreItems() {
  const q = S.q.trim().toLowerCase();
  const mineApps = appsOf(me);
  const arr = []; let hidden = 0;
  S.users.forEach((u, id) => {
    if (id === me) return;
    if (S.fc && u.country !== S.fc) return;
    appsOf(id).forEach(a => {
      if (q && (a.name + ' ' + (u.nick || '') + ' ' + (a.cat || '')).toLowerCase().indexOf(q) < 0) return;
      const ex = swapForCard(id, a.id);
      const ok = canTest(me, id, a.id) && (!mineApps.length || mineApps.some(m => canTest(id, me, m.id)));
      if (!ex && !ok) { hidden++; return; }
      arr.push({ id, u, a, ex, st: stats(id, a) });
    });
  });
  arr.sort((x, y) => y.st.done - x.st.done || (y.u.createdAt || 0) - (x.u.createdAt || 0));
  const note = hidden ? '<p class="small muted">' + hidden + (hidden === 1 ? ' app nascosta perché non è' : ' app nascoste perché non sono') + ' compatibili con i paesi richiesti da te o da loro.</p>' : '';
  if (!arr.length) return '<div class="empty"><h3>Nessuna app da testare per ora</h3><p class="muted">' + (q || S.fc ? 'Prova con un altro nome, categoria o paese.' : 'Pubblica la tua app dal profilo e invita altri sviluppatori.') + '</p></div>' + note;
  return arr.map(x => {
    let act, pickH = '';
    if (!mineApps.length || !countryOf(me)) act = '<button class="btn ghost" data-act="tab" data-tab="profile">Completa prima il tuo profilo</button>';
    else if (x.ex) act = '<button class="btn" data-act="swap" data-id="' + esc(x.ex.id) + '">Apri scambio</button>';
    else {
      const elig = mineApps.filter(m => canTest(x.id, me, m.id) && canTest(me, x.id, x.a.id) && !pairOpen(x.id, m.id, x.a.id));
      if (!elig.length) act = '<p class="small muted">Nessuna delle tue app è compatibile o libera per questo scambio.</p>';
      else {
        const key = x.id + '-' + x.a.id; const cur = elig.find(m => m.id === S.pick[key]) || elig[0];
        if (elig.length > 1) pickH = '<label for="pick-' + esc(key) + '">Con quale tua app?<select class="pick" id="pick-' + esc(key) + '" data-key="' + esc(key) + '">' + elig.map(m => '<option value="' + esc(m.id) + '"' + (m.id === cur.id ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</select></label>';
        act = '<button class="btn primary" data-act="propose" data-id="' + esc(x.id) + '" data-oa="' + esc(x.a.id) + '" data-ma="' + esc(cur.id) + '">Proponi scambio 1 a 1</button>';
      }
    }
    return '<article class="card app' + xcls(x.a.id) + '"><div class="row between"><button class="who" data-act="user" data-id="' + esc(x.id) + '">' + av(x.id) + '<span class="n">' + esc(nameOf(x.id)) + '</span></button>' + rate(x.st) + '</div>'
      + '<div><div class="row" style="margin-bottom:4px"><span class="small muted mono">' + (isExtra(x.a.id) ? '' : '📱 ') + 'APP DA TESTARE</span>' + xtag(x.a.id) + '</div><h3 class="appname">' + esc(x.a.name) + '</h3><div class="row" style="margin-top:4px"><span class="chip">' + esc(x.a.cat || 'Altro') + '</span><span class="chip">' + esc(x.u.country || 'Paese n.d.') + '</span><span class="chip">Cerca: ' + esc(x.a.want || 'tutti i paesi') + '</span><span class="small muted">' + x.st.done + ' tester completati</span></div></div>'
      + (x.a.desc ? '<p class="desc">' + esc(x.a.desc) + '</p>' : '')
      + pickH + '<div>' + act + '</div></article>';
  }).join('') + note;
}
function countryFilter() {
  const have = new Set(); S.users.forEach((u, id) => { if (id !== me && u.country && appsOf(id).length) have.add(u.country); });
  const list = COUNTRIES.filter(c => have.has(c) || c === S.fc);
  return '<label for="fc">Paese dello sviluppatore<select id="fc"><option value="">Tutti i paesi</option>' + list.map(c => '<option' + (c === S.fc ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>';
}
const fmtN = n => Number(n).toLocaleString('it-IT');
function statsBanner() {
  let devs = 0, apps = 0, tests = 0;
  S.users.forEach((u, id) => { if (!u || !u.nick) return; devs++; apps += appsOf(id).length; tests += id === me ? Math.min(100, myTesting()) : Math.min(100, Math.max(0, Math.floor(+u.testing || 0))); });
  const c = (x, n, l) => '<div class="sn" style="left:' + x + '%"><b>' + fmtN(n) + '</b><span>' + l + '</span></div>';
  return '<div class="stats" role="group" aria-label="' + fmtN(devs) + ' sviluppatori iscritti, ' + fmtN(tests) + ' test in corso, ' + fmtN(apps) + ' app pubblicate"><img src="contatore2.jpg" alt="" width="1600" height="888" decoding="async">'
    + c(46.3, devs, 'Sviluppatori<br>Iscritti') + c(67.4, tests, 'Test in<br>Corso') + c(88.5, apps, 'App<br>Pubblicate') + '</div>';
}
function introBox() {
  return '<section class="intro"><p class="intro-t">La piattaforma P2P per indie developer: scambiatevi i 12 tester di Google Play e fate conoscere la vostra idea.</p>'
    + '<p class="intro-s">Tu testi la loro app, loro testano la tua. Gratis, 1 a 1, in 14 giorni.</p>'
    + (isInstalled() ? '' : '<button type="button" class="btn primary intro-b" data-act="installOpen">📱 Come installarla sul telefono</button>') + '</section>';
}
const exploreView = () => statsBanner() + introBox() + '<div class="grid2"><label for="q">Cerca un\'app<input id="q" type="search" value="' + esc(S.q) + '" placeholder="Nome, categoria o sviluppatore"></label>' + countryFilter() + '</div><div id="list" class="stack">' + exploreItems() + '</div>' + inviteBox(true);

function swapCard(s) {
  const o = s.a === me ? s.b : s.a; const el = elapsed(s, me);
  const oa = (s.apps && s.apps[o] && s.apps[o].name) || 'la sua app', ma = (s.apps && s.apps[me] && s.apps[me].name) || 'la tua app';
  let h = '<article class="card"><div class="row between"><button class="who" data-act="swap" data-id="' + esc(s.id) + '">' + av(o) + '<span class="n">' + esc(nameOf(o)) + '</span>' + (unreadInfo(s).n ? '<span class="dot" role="status" aria-label="' + unreadInfo(s).n + ' novità">' + (unreadInfo(s).n > 9 ? '9+' : unreadInfo(s).n) + '</span>' : '') + '</button>' + statusPill(s) + '</div>'
    + '<div class="mini' + xcls(aidOf(s, o)) + '"><span class="small muted mono">TU TESTI</span><div class="row between"><b>' + esc(oa) + '</b>' + xtag(aidOf(s, o)) + '</div></div>'
    + '<div class="mini' + xcls(aidOf(s, me)) + '"><span class="small muted mono">LUI TESTA</span><div class="row between"><b>' + esc(ma) + '</b>' + xtag(aidOf(s, me)) + '</div></div>'
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
function statBlock(uid, a, multi) {
  const st = stats(uid, a);
  return '<div class="card"><div class="row between"><h3>Tester completati' + (multi && a ? ' · ' + esc(a.name) : '') + '</h3><span class="mono">' + Math.min(st.done, 12) + '/12</span></div>' + meter(Math.min(st.done, 12))
    + '<p class="small muted">Google Play chiede 12 tester per 14 giorni consecutivi. Conta ogni persona che ha testato la tua app per 14 giorni e ha lasciato il feedback.</p>'
    + '<div class="row between"><span class="small muted">Valutazione media</span>' + rate(st) + '</div></div>';
}
function appFields(k, ap, title, bonus) {
  const n = openCount(k), lock = n > 0 && !!ap.name, dis = lock ? ' disabled' : '';
  const wopts = '<option value="">Qualsiasi paese</option>' + COUNTRIES.map(c => '<option value="' + c + '"' + (ap.want === c ? ' selected' : '') + '>Solo ' + c + '</option>').join('');
  const opts = CATS.map(c => '<option' + ((ap.cat || 'Altro') === c ? ' selected' : '') + '>' + c + '</option>').join('');
  const note = lock ? '<div class="banner">App bloccata: hai ' + n + (n === 1 ? ' scambio aperto' : ' scambi aperti') + '. Puoi cambiarla quando tutti gli scambi di questa app sono completati, rifiutati o chiusi. Li trovi in <b>Scambi</b>.' + (k === 'main' && bonus < MAX_EXTRA ? ' Vuoi far testare un\'altra app subito? Usa le Lune o invita un amico qui sopra.' : '') + '</div>'
    : (k !== 'main' && !ap.name ? '<p class="small muted">Spazio sbloccato. Lascialo vuoto se non ti serve.</p>' : '');
  const lk = linkFor(k);
  let conclude = '';
  if (k !== 'main' && ap.name && !lock) {
    conclude = S.confirmK === k
      ? '<div class="box"><p class="small"><b>Concludere questa app?</b> Viene tolta dal profilo e lo slot si azzera. Per usarlo di nuovo dovrai invitare un altro amico. Gli scambi già completati restano.</p><div class="row"><button type="button" class="btn primary sm" data-act="concludeApp" data-k="' + k + '">Sì, concludi</button><button type="button" class="btn ghost sm" data-act="noConclude">Annulla</button></div></div>'
      : '<div><button type="button" class="btn ghost sm" data-act="askConclude" data-k="' + k + '">Concludi app e libera lo slot</button></div>';
  }
  const pill = k === 'main' ? (lock ? '<span class="pill warn">Bloccata</span>' : '<span class="pill ok">Principale</span>')
    : (lock ? '<span class="pill warn">Bloccata</span>' : ap.name ? '<span class="pill ok">In uso</span>' : '<span class="pill ok">Sbloccato · libero</span>');
  return '<div class="slot' + (k === 'main' ? ' main' : '') + '"><div class="row between"><h3>' + title + '</h3>' + pill + '</div>' + note
    + '<label for="f-app-' + k + '">Nome dell\'app<input id="f-app-' + k + '" maxlength="50"' + dis + ' value="' + esc(ap.name || '') + '"><span class="field-note" id="c-f-app-' + k + '">' + (ap.name || '').length + '/50</span></label>'
    + '<div class="grid2"><label for="f-cat-' + k + '">Categoria<select id="f-cat-' + k + '"' + dis + '>' + opts + '</select></label>'
    + '<label for="f-link-' + k + '">Link di adesione al test<input id="f-link-' + k + '" type="url" inputmode="url"' + dis + ' value="' + esc(lk) + '" placeholder="https://play.google.com/apps/testing/..."><span class="field-note">Resta privato: lo vede solo chi accetta uno scambio con te.</span></label></div>'
    + '<label for="f-want-' + k + '">Tester che ti servono<select id="f-want-' + k + '"' + dis + '>' + wopts + '</select><span class="field-note">Vedrai e potrai scambiare solo con chi è di quel paese e accetta il tuo.</span></label>'
    + '<label for="f-desc-' + k + '">Cosa deve provare il tester<textarea id="f-desc-' + k + '" maxlength="500"' + dis + ' placeholder="Cosa fa l\'app e cosa vorresti che controllasse">' + esc(ap.desc || '') + '</textarea><span class="field-note" id="c-f-desc-' + k + '">' + (ap.desc || '').length + '/500</span></label>' + conclude + '</div>';
}
function profileView(uid, edit) {
  const u = S.users.get(uid) || {}; const ap = u.app || {};
  if (!edit) {
    const list = appsOf(uid);
    return '<button class="btn ghost sm back" data-act="back">← Indietro</button>'
      + '<div class="card"><div class="row">' + av(uid) + '<div><h2>' + esc(nameOf(uid)) + '</h2><span class="chip">' + esc(u.country || 'Paese n.d.') + '</span></div></div>' + (u.bio ? '<p class="desc">' + esc(u.bio) + '</p>' : '') + '</div>'
      + list.map(a => '<div class="card"><span class="small muted mono">APP DA TESTARE</span><h3 class="appname">' + esc(a.name) + '</h3><div class="row"><span class="chip">' + esc(a.cat || 'Altro') + '</span><span class="chip">Cerca: ' + esc(a.want || 'tutti i paesi') + '</span></div>' + (a.desc ? '<p class="desc">' + esc(a.desc) + '</p>' : '') + '</div>').join('')
      + (list.length ? list.map(a => statBlock(uid, a, list.length > 1)).join('') : statBlock(uid)) + '<section class="card"><h3>Feedback ricevuti</h3>' + fbList(uid) + '</section>';
  }
  const copts = (u.country ? '' : '<option value="">Scegli il tuo paese</option>') + COUNTRIES.map(c => '<option value="' + c + '"' + (u.country === c ? ' selected' : '') + '>' + c + '</option>').join('');
  const bonus = creditsTotal(u); const shown = slotsShown(u);
  const mineList = appsOf(uid);
  return (!S.users.get(me) ? '<div class="banner">Completa il profilo e pubblica la tua app per poter proporre scambi.</div>' : '')
    + moonCard(u)
    + inviteBox(false)
    + '<form id="pf" class="card" autocomplete="off"><h2>Il tuo profilo</h2>'
    + '<label for="f-nick">Nome visibile<input id="f-nick" maxlength="30" value="' + esc(u.nick || '') + '" placeholder="Come ti chiamano gli altri"></label>'
    + '<label for="f-bio">Chi sei<textarea id="f-bio" maxlength="200" placeholder="Una riga su di te">' + esc(u.bio || '') + '</textarea><span class="field-note" id="c-f-bio">' + (u.bio || '').length + '/200</span></label>'
    + '<label for="f-email">Email dell\'account Google per i test<input id="f-email" type="email" inputmode="email" value="' + esc(S.priv.email || '') + '" placeholder="nome@gmail.com"><span class="field-note">Resta privata. Viene condivisa solo dentro uno scambio e solo se condividi anche tu.</span></label>'
    + '<label for="f-country">Il tuo paese<select id="f-country">' + copts + '</select><span class="field-note">Serve per far combaciare le richieste di tester. Lo scrivi tu, non viene verificato.</span></label>'
    + appFields('main', ap, '📱 La tua app', bonus)
    + shown.map((k, i) => appFields(k, (u.extra && u.extra[k]) || {}, '🧩 Slot App Extra #' + (i + 1), bonus)).join('')
    + (S.users.get(me) && ap.name && freeSlots(u) === 0 && extraCount(u) < MAX_EXTRA
      ? '<div class="box"><b>Vuoi far testare un\'altra app?</b><p class="small muted">Hai usato lo slot gratuito. Sblocca uno slot con le Lune, invitando un amico o subito per ' + SLOT_PRICE + '.</p>' + (S.slotReq ? '<p class="small"><b>Pagamento in verifica:</b> lo slot si sblocca appena confermato.</p>' : '') + '<div><button type="button" class="btn" data-act="slotOpen">+ Aggiungi un\'altra app</button></div></div>' : '')
    + '<div><button class="btn primary" type="submit">Salva profilo</button></div></form>'
    + (mineList.length ? mineList.map(a => statBlock(uid, a, mineList.length > 1)).join('') : statBlock(uid)) + '<section class="card"><h3>Feedback ricevuti</h3>' + fbList(uid) + '</section>' + adminBox() + aboutBox() + deleteBox();
}

/* ---------- Chi siamo & guida ---------- */
/* Vero se l'app è aperta come PWA installata (schermata Home) o come app Android, falso nel browser. */
function isInstalled() {
  try {
    const mm = q => !!(window.matchMedia && window.matchMedia(q).matches);
    return mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || mm('(display-mode: minimal-ui)')
      || navigator.standalone === true || (document.referrer || '').indexOf('android-app://') === 0;
  } catch (e) { return false; }
}
const ICON_INFO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
function aboutBox() {
  return '<section class="card"><button type="button" class="menuitem" data-act="aboutOpen"><span class="row">' + ICON_INFO + '<b>Chi siamo</b></span><span aria-hidden="true">›</span></button>'
    + (PAYPAL_ME ? '<a class="menuitem" style="text-decoration:none" target="_blank" rel="noopener noreferrer" href="' + esc(tipUrl()) + '"><span class="row"><span aria-hidden="true">☕</span><b>Offrimi un caffè</b></span><span aria-hidden="true">›</span></a>' : '') + '</section>';
}
let aboutFocus = null;
function closeAbout() {
  const m = $('#about'); if (m) m.remove();
  document.removeEventListener('keydown', aboutKey);
  if (aboutFocus && document.contains(aboutFocus)) aboutFocus.focus(); aboutFocus = null;
}
function aboutKey(e) { if (e.key === 'Escape') closeAbout(); }
function openModal(title, body) {
  if ($('#about')) return;
  aboutFocus = document.activeElement;
  const bg = document.createElement('div'); bg.id = 'about'; bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="about-t"><div class="row between"><h2 id="about-t">' + title + '</h2><button type="button" class="btn ghost sm" data-act="aboutClose" aria-label="Chiudi">✕</button></div>'
    + '<div class="stack">' + body + '</div></div>';
  bg.addEventListener('click', e => { if (e.target === bg) closeAbout(); });
  document.body.appendChild(bg); document.addEventListener('keydown', aboutKey);
  const cb = bg.querySelector('[data-act="aboutClose"]'); if (cb) cb.focus();
}
function openAbout() {
  openModal('Chi siamo', '<div><h3>🚀 Chi siamo</h3><p style="margin-top:6px">IronBlind (ironblind.it) nasce per aiutare gli sviluppatori indipendenti a superare il requisito di 12 tester per 14 giorni imposto da Google Play Console. La nostra community permette agli sviluppatori di fare squadra, testare reciprocamente le app e scambiare feedback costruttivi.</p></div>'
    + (PAYPAL_ME ? '<div class="step"><h3>☕ Sostieni IronBlind</h3><p>IronBlind è gratuita. Se ti è utile puoi offrirmi un caffè con PayPal, con l\'importo che preferisci. Non sblocca nulla: è solo un grazie.</p><a class="btn primary" style="text-align:center;text-decoration:none" target="_blank" rel="noopener noreferrer" href="' + esc(tipUrl()) + '">Offrimi un caffè con PayPal</a></div>' : ''));
}
function openInstall() {
  openModal('Come installare l\'app', '<div class="step"><h3>📱 Come installare IronBlind sul telefono (PWA)</h3>'
    + '<p>IronBlind è una Progressive Web App (PWA). Puoi aggiungerla alla schermata Home del telefono per usarla come un\'app nativa:</p>'
    + '<ul class="guide"><li><b>Android (Chrome):</b> Menu ⋮ in alto a destra ➔ "Aggiungi a schermata Home" o "Installa app".</li>'
    + '<li><b>iPhone/iPad (Safari):</b> Tasto Condividi (quadrato con freccia in alto) ➔ "Aggiungi alla schermata Home".</li></ul>'
    + (isInstalled() ? '<p class="small muted">Stai già usando l\'app installata: non devi fare nulla.</p>' : '') + '</div>');
}
function moonCard(u) {
  if (!S.users.get(me)) return '';
  const bal = moonBalance(u), pct = Math.min(100, Math.round(bal / MOON_COST * 100));
  const can = bal >= MOON_COST && creditsTotal(u) < MAX_EXTRA;
  return '<div class="card"><div class="row between"><h2>Le tue Lune</h2><span class="pill ok" aria-label="' + bal + ' Lune">' + moonLabel(bal) + '</span></div>'
    + '<div class="bar" role="img" aria-label="' + bal + ' su ' + MOON_COST + ' Lune"><i style="width:' + pct + '%"></i></div>'
    + '<p class="small muted">Ogni giorno di test completato ti dà +1 Luna (massimo 14 per scambio). Con ' + MOON_COST + ' Lune sblocchi uno slot extra. Ne hai ' + Math.min(bal, MOON_COST) + '/' + MOON_COST + '.</p>'
    + (can ? '<div><button type="button" class="btn primary" data-act="moonRedeem">Usa ' + MOON_COST + ' Lune per sbloccare uno Slot Extra</button></div>'
      : (bal >= MOON_COST ? '<p class="small muted">Hai già il massimo di slot extra.</p>' : '')) + '</div>';
}
/* ---------- Slot extra: Lune, inviti o pagamento ---------- */
function closeSlot() { const m = $('#slotm'); if (m) m.remove(); document.removeEventListener('keydown', slotKey); }
function slotKey(e) { if (e.key === 'Escape') closeSlot(); }
function openSlot() {
  closeSlot();
  const u = S.users.get(me) || {}; const bal = moonBalance(u); const code = esc(me);
  const optA = '<div class="step"><h3>🌕 Con le Lune (gratis)</h3><p class="small muted">Ogni giorno di test completato = +1 Luna. Hai ' + moonLabel(bal) + ': servono ' + MOON_COST + '.</p>'
    + (bal >= MOON_COST ? '<div><button type="button" class="btn primary" data-act="moonRedeem">Usa ' + MOON_COST + ' Lune per sbloccare uno Slot Extra</button></div>'
      : '<div class="bar"><i style="width:' + Math.round(bal / MOON_COST * 100) + '%"></i></div><p class="small muted">Te ne mancano ' + (MOON_COST - bal) + '.</p>') + '</div>';
  const optI = '<div class="step"><h3>👥 Invita un amico (gratis)</h3><p class="small muted">Quando si registra con il tuo link e pubblica la sua app, ottieni uno slot extra.</p><div><button type="button" class="btn" data-act="invite">Invita un amico</button></div></div>';
  const optB = !PAYPAL_ME ? '' : '<div class="step"><h3>⚡ Subito: ' + SLOT_PRICE + '</h3>'
    + '<p class="small muted">Paga con PayPal e scrivi nella nota il tuo codice. Dopo la verifica, di solito entro 24 ore, lo slot si sblocca da solo.</p>'
    + '<div class="box"><span class="small muted">Il tuo codice</span><code class="small" style="overflow-wrap:anywhere">' + code + '</code><div><button type="button" class="btn sm" data-act="copy" data-text="' + code + '" data-msg="Codice copiato">Copia codice</button></div></div>'
    + '<a class="btn primary" style="text-align:center;text-decoration:none" target="_blank" rel="noopener noreferrer" href="' + esc(payUrl()) + '">Paga ' + SLOT_PRICE + ' con PayPal</a>'
    + (S.slotReq ? '<p class="small"><b>Richiesta già inviata:</b> stiamo verificando il pagamento.</p>' : '')
    + '<label for="slot-payer">Nome o email usati su PayPal<input id="slot-payer" maxlength="100" placeholder="Facoltativo, aiuta a trovare il pagamento"></label>'
    + '<div><button type="button" class="btn" data-act="slotPaid">Ho pagato, avvisa</button></div></div>';
  const bg = document.createElement('div'); bg.id = 'slotm'; bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="slot-t"><div class="row between"><h2 id="slot-t">Slot app extra</h2><button type="button" class="btn ghost sm" data-act="slotClose" aria-label="Chiudi">✕</button></div>'
    + '<p>Hai usato lo slot gratuito. Per far testare un\'altra app scegli una strada:</p>' + optA + optI + optB + '</div>';
  bg.addEventListener('click', e => { if (e.target === bg) closeSlot(); });
  document.body.appendChild(bg); document.addEventListener('keydown', slotKey);
  const cb = bg.querySelector('[data-act="slotClose"]'); if (cb) cb.focus();
}
/* Aggiunge uno slot pagato all'utente e toglie la sua richiesta, se c'è. */
async function grantSlot(uid) {
  const cur = await getDoc(doc(db, 'paid', uid)); const n = Math.min(MAX_EXTRA, ((cur.exists() && cur.data().slots) || 0) + 1);
  await setDoc(doc(db, 'paid', uid), { slots: n });
  try { await deleteDoc(doc(db, 'slotRequests', uid)); } catch (e) { /* nessuna richiesta */ }
  return n;
}
const isAdminUser = () => !!(auth && auth.currentUser && auth.currentUser.email === ADMIN_EMAIL && auth.currentUser.emailVerified);
function adminBox() {
  if (!isAdminUser()) return '';
  const l = []; S.reqs.forEach((r, uid) => l.push([uid, r]));
  l.sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  const byCode = '<div class="box"><b>Sblocca con il codice</b><p class="small muted">Se hai ricevuto un pagamento ma non c\'è la richiesta, incolla qui il codice scritto nel messaggio di PayPal.</p><label for="adm-code">Codice utente<input id="adm-code" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Incolla il codice"></label><div><button type="button" class="btn primary sm" data-act="adminGrantCode">Sblocca +1 slot</button></div></div>';
  return '<section class="card"><h3>Richieste slot (solo tu)</h3>' + byCode + (l.length ? l.map(x => '<div class="box"><div class="row between"><b>' + esc(nameOf(x[0])) + '</b><span class="small muted">' + fmtD(x[1].at || Date.now()) + '</span></div><p class="small">PayPal: ' + esc(x[1].payer || 'non indicato') + '</p><code class="small" style="overflow-wrap:anywhere">' + esc(x[0]) + '</code><div class="row"><button type="button" class="btn primary sm" data-act="adminGrant" data-id="' + esc(x[0]) + '">Sblocca +1 slot</button><button type="button" class="btn ghost sm" data-act="adminDrop" data-id="' + esc(x[0]) + '">Elimina richiesta</button></div></div>').join('') : '<p class="small muted">Nessuna richiesta in attesa.</p>') + '</section>';
}
const SUPPORT = 'Blinders.NL8993@gmail.com';
function deleteBox() {
  const user = auth && auth.currentUser;
  const hasPw = !!(user && user.providerData.some(p => p.providerId === 'password'));
  const head = '<section class="card"><h3>Account e privacy</h3><p class="small muted">Per informazioni o per segnalare un problema scrivi a <a href="mailto:' + SUPPORT + '">' + SUPPORT + '</a>. Puoi eliminare il tuo account e i tuoi dati in qualsiasi momento.</p>';
  if (!S.delOpen) return head + '<div><button class="btn ghost" data-act="delOpen">Elimina il mio account</button></div></section>';
  return head + '<div class="box"><b>Cosa succede</b>'
    + '<p class="small"><b>Vengono eliminati:</b> profilo, nome dell\'app, email e link di test, messaggi che hai inviato e testo dei feedback che hai scritto.</p>'
    + '<p class="small"><b>Vengono chiusi:</b> gli scambi in corso e le richieste in attesa.</p>'
    + '<p class="small"><b>Restano, in forma anonima:</b> le stelle che hai dato e gli scambi già completati, perché contano per l\'altro sviluppatore. I feedback ricevuti non sono più collegati a nessun profilo.</p>'
    + '<p class="small">L\'operazione non si può annullare.</p></div>'
    + '<label for="del-word">Scrivi ELIMINA per confermare<input id="del-word" autocomplete="off" autocapitalize="characters" placeholder="ELIMINA"></label>'
    + (hasPw ? '<label for="del-pass">La tua password<input id="del-pass" type="password" autocomplete="current-password"></label>' : '<p class="small muted">Ti verrà chiesto di accedere di nuovo con Google per confermare.</p>')
    + '<div class="row"><button class="btn primary" data-act="delGo">Elimina definitivamente</button><button class="btn ghost" data-act="delClose">Annulla</button></div></section>';
}
async function deleteAccount() {
  const user = auth.currentUser; if (!user) return;
  if ((($('#del-word') || {}).value || '').trim().toUpperCase() !== 'ELIMINA') { toast('Scrivi ELIMINA per confermare.'); return; }
  const hasPw = user.providerData.some(p => p.providerId === 'password');
  const pw = (($('#del-pass') || {}).value || '');
  if (hasPw && !pw) { toast('Scrivi la tua password per confermare.'); return; }
  busy = true;
  try {
    // 1. Conferma di nuovo chi sei, richiesto da Firebase per eliminare un account.
    if (hasPw) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw));
    else await reauthenticateWithPopup(user, new GoogleAuthProvider());
    // 2. Chiude gli scambi aperti e toglie i tuoi dati dagli scambi.
    const swaps = []; S.swaps.forEach((sw, sid) => swaps.push([sid, sw]));
    for (const [sid, sw] of swaps) {
      if (sw.status !== 'declined' && !isDone(sw)) await updateDoc(doc(db, 'swaps', sid), { status: 'declined' });
      await deleteDoc(doc(db, 'swaps', sid, 'links', me));
      await deleteDoc(doc(db, 'swaps', sid, 'emails', me));
      const mine_ = await getDocs(query(collection(db, 'swaps', sid, 'messages'), where('from', '==', me)));
      for (const d of mine_.docs) await deleteDoc(d.ref);
    }
    // 3. Rende anonimi i feedback che hai scritto: restano le stelle, sparisce il testo e il tuo nome.
    const fbs = await getDocs(query(collection(db, 'feedback'), where('from', '==', me)));
    for (const d of fbs.docs) await updateDoc(d.ref, { text: '', from: 'deleted' });
    // 4. Elimina profilo, dati privati e account.
    try { await deleteDoc(doc(db, 'slotRequests', me)); await deleteDoc(doc(db, 'paid', me)); } catch (e) { /* nessuna richiesta da togliere */ }
    try { await deleteDoc(doc(db, 'refs', me)); } catch (e) { /* nessun invito da togliere */ }
    await deleteDoc(doc(db, 'userPrivate', me));
    await deleteDoc(doc(db, 'users', me));
    try { localStorage.removeItem(seenKey()); } catch (e) { /* nessuna memoria locale */ }
    await deleteUser(user);
    toast('Account eliminato.');
  } catch (e) {
    if (e && e.code && String(e.code).indexOf('auth/') === 0) { if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') authErr(e); }
    else toastErr(e);
  } finally { busy = false; if (me) render(true); }
}
function swapView(id) {
  const s = S.swaps.get(id) && Object.assign({ id }, S.swaps.get(id));
  const back = '<button class="btn ghost sm back" data-act="back">← Indietro</button>';
  if (!s) return back + '<div class="empty"><h3>Scambio non trovato</h3></div>';
  const o = s.a === me ? s.b : s.a;
  const oApp = (s.apps && s.apps[o]) || {}, mApp = (s.apps && s.apps[me]) || {};
  let h = back + '<div class="card"><div class="row between"><button class="who" data-act="user" data-id="' + esc(o) + '">' + av(o) + '<span class="n">' + esc(nameOf(o)) + '</span></button>' + statusPill(s) + '</div>'
    + '<div class="box mini' + xcls(aidOf(s, o)) + '"><div class="row between"><span class="small muted mono">TU TESTI</span>' + xtag(aidOf(s, o)) + '</div><b>' + esc(oApp.name || 'App') + '</b>'
    + (s.status === 'active' ? (S.theirLink ? link(S.theirLink) : '<span class="small muted">Il link di test non è disponibile.</span>') : '<span class="small muted">Il link di test si sblocca quando lo scambio viene accettato.</span>') + '</div>'
    + '<div class="box mini' + xcls(aidOf(s, me)) + '"><div class="row between"><span class="small muted mono">LUI TESTA</span>' + xtag(aidOf(s, me)) + '</div><b>' + esc(mApp.name || 'La tua app') + '</b></div></div>';
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
const loginForm = '<div class="stack" style="width:100%"><img class="logo-big" src="logo.png" width="112" height="112" alt="IronBlind Test App"><div><button class="btn primary" data-act="login">Accedi con Google</button></div>'
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
  if (!me) return gate('Accedi per iniziare', (pendingInvite ? 'Sei stato invitato da un amico: registrati e pubblica la tua app per sbloccargli un\'app extra. ' : '') + 'Crei il profilo, proponi scambi e chatti con gli altri sviluppatori. Se è la prima volta con email e password, tocca Registrati.', loginForm);
  if (!(loaded.users && loaded.swaps && loaded.fb && loaded.priv)) return;
  if (!firstRoute) { firstRoute = true; if (!S.users.get(me)) S.tab = 'profile'; }
  if (S.route && S.route.t === 'swap') markSeen(S.route.id);
  syncWatch(); syncMoons();
  const rec = mine().filter(s => (s.status === 'proposed' && s.b === me) || (s.status !== 'declined' && unreadOf(s).length)).length;
  document.title = (rec ? '(' + rec + ') ' : '') + 'IronBlind Test App';
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
    if (act === 'slotOpen') { openSlot(); return; }
    if (act === 'slotClose') { closeSlot(); return; }
    if (act === 'askConclude') { S.confirmK = b.dataset.k; render(true); return; }
    if (act === 'noConclude') { S.confirmK = null; render(true); return; }
    if (act === 'aboutOpen') { openAbout(); return; }
    if (act === 'installOpen') { openInstall(); return; }
    if (act === 'aboutClose') { closeAbout(); return; }
    if (act === 'logout') { await signOut(auth); return; }
    if (act === 'delOpen') { S.delOpen = true; render(true); return; }
    if (act === 'delClose') { S.delOpen = false; render(true); return; }
    if (act === 'delGo') { await deleteAccount(); return; }
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
    if (act === 'invite') {
      const url = inviteLink(), text = 'Ti invito su IronBlind Test App: ci scambiamo i test di 14 giorni per le nostre app Android.';
      if (navigator.share) { try { await navigator.share({ title: 'IronBlind Test App', text, url }); } catch (x) { /* condivisione annullata */ } return; }
      try { await navigator.clipboard.writeText(text + ' ' + url); toast('Link copiato!'); } catch (x) { toast('Copia non disponibile: ' + url); }
      return;
    }
    if (act === 'copy') { try { await navigator.clipboard.writeText(b.dataset.text); toast(b.dataset.msg || 'Email copiata'); } catch (x) { toast('Copia non disponibile: seleziona il testo a mano'); } return; }
    busy = true; b.disabled = true;
    const s = S.swaps.get(id);
    if (act === 'moonRedeem') {
      const u = S.users.get(me);
      if (!u || moonBalance(u) < MOON_COST) { toast('Non hai abbastanza Lune.'); return; }
      if (creditsTotal(u) >= MAX_EXTRA) { toast('Hai già il massimo di slot extra.'); return; }
      await updateDoc(doc(db, 'users', me), { moonsSpent: (u.moonsSpent || 0) + MOON_COST, moons: moonTotal(u) });
      closeSlot(); toast('Slot extra sbloccato con ' + MOON_COST + ' Lune! Aggiungi la nuova app dal Profilo.');
    } else if (act === 'slotPaid') {
      const payer = (($('#slot-payer') || {}).value || '').trim().slice(0, 100);
      await setDoc(doc(db, 'slotRequests', me), { at: Date.now(), payer });
      toast('Richiesta inviata. Sblocchiamo lo slot dopo aver verificato il pagamento.'); closeSlot();
    } else if (act === 'adminGrant') {
      if (!isAdminUser()) return;
      await grantSlot(id); toast('Slot sbloccato per ' + nameOf(id));
    } else if (act === 'adminGrantCode') {
      if (!isAdminUser()) return;
      const code = (($('#adm-code') || {}).value || '').trim();
      if (!code || !S.users.has(code)) { toast('Codice non trovato. Controlla di averlo copiato per intero.'); return; }
      const n = await grantSlot(code); toast('Slot sbloccato per ' + nameOf(code) + ' (totale pagati: ' + n + ')');
    } else if (act === 'adminDrop') {
      if (!isAdminUser()) return;
      await deleteDoc(doc(db, 'slotRequests', id)); toast('Richiesta eliminata');
    } else if (act === 'concludeApp') {
      const k = b.dataset.k, u = S.users.get(me);
      if (!u || !hasExtra(u, k)) { S.confirmK = null; return; }
      if (openCount(k) > 0) { toast('Questa app ha ancora scambi aperti.'); return; }
      const nu = Object.assign({}, u); nu.extra = Object.assign({}, u.extra); delete nu.extra[k];
      if (!Object.keys(nu.extra).length) delete nu.extra;
      const inv = validInvites()[0];
      if (inv) nu.spent = (u.spent || []).concat(inv); else if (otherCredits(u) > 0) nu.spent = (u.spent || []).concat('#');
      nu.updatedAt = Date.now();
      await setDoc(doc(db, 'users', me), nu);
      const pv = { email: S.priv.email || '', link: S.priv.link || '' }; const el = Object.assign({}, S.priv.extraLinks || {}); delete el[k];
      if (Object.keys(el).length) pv.extraLinks = el;
      await setDoc(doc(db, 'userPrivate', me), pv);
      S.confirmK = null; toast('App conclusa. Lo slot si è azzerato: invita un altro amico per riaverlo.');
    } else if (act === 'propose') {
      const oA = b.dataset.oa || 'main'; const them = appOf(id, oA);
      const sel = document.getElementById('pick-' + id + '-' + oA);
      const mA = (sel && sel.value) || b.dataset.ma || 'main'; const mineA = appOf(me, mA);
      if (!mineA) { toast('Pubblica prima la tua app nel profilo.'); return; }
      if (!them) return;
      if (pairOpen(id, mA, oA)) { toast('Avete già uno scambio aperto con queste app.'); return; }
      if (!countryOf(me)) { toast('Scegli prima il tuo paese nel profilo.'); return; }
      if (!compat(me, mA, id, oA)) { toast('Scambio non compatibile con i paesi richiesti.'); return; }
      const lk = linkFor(mA);
      if (!lk) { toast('Aggiungi nel profilo il link di adesione al test di ' + mineA.name + '.'); return; }
      const apps = {}; apps[me] = { name: mineA.name }; apps[id] = { name: them.name };
      const appIds = {}; appIds[me] = mA; appIds[id] = oA;
      const ref = await addDoc(collection(db, 'swaps'), { a: me, b: id, members: [me, id], apps, appIds, status: 'proposed', createdAt: Date.now(), start: {}, fb: {} });
      await setDoc(doc(db, 'swaps', ref.id, 'links', me), { link: lk });
      toast('Richiesta inviata'); S.tab = 'swaps'; S.route = { t: 'swap', id: ref.id };
    } else if (act === 'accept') {
      const oo = s.a === me ? s.b : s.a; const mA = aidOf(s, me), oA = aidOf(s, oo);
      if (!appOf(me, mA)) { toast('L\'app di questo scambio non è più nel tuo profilo.'); return; }
      if (!compat(me, mA, oo, oA)) { toast('Scambio non compatibile con i paesi richiesti.'); return; }
      const lk = linkFor(mA);
      if (!lk) { toast('Aggiungi nel profilo il link di adesione al test della tua app, poi accetta.'); return; }
      const ab = writeBatch(db);
      ab.set(doc(db, 'swaps', id, 'links', me), { link: lk });
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
document.addEventListener('change', e => { const t = e.target; if (t && t.id === 'fc') { S.fc = t.value; const l = $('#list'); if (l) l.innerHTML = exploreItems(); } if (t && t.classList && t.classList.contains('pick')) S.pick[t.dataset.key] = t.value; });
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
    const nick = $('#f-nick').value.trim(), email = $('#f-email').value.trim();
    if (!nick) { toast('Scrivi il nome visibile.'); return; }
    const country = $('#f-country').value; if (!country) { toast('Scegli il tuo paese.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Controlla l\'email.'); return; }
    const old = S.users.get(me) || {};
    const ks = ['main'].concat(slotsShown(old));
    for (const k of ks) { const l = ($('#f-link-' + k).value || '').trim(); if (l && !/^https:\/\//i.test(l)) { toast('Il link deve iniziare con https://'); return; } }
    busy = true;
    try {
      const extra = {}, extraLinks = {}; let mainApp = null, mainLink = '';
      for (const k of ks) {
        const prev = Object.assign({}, k === 'main' ? (old.app || {}) : ((old.extra || {})[k] || {})); delete prev.link;
        // Con scambi aperti su quell'app non si cambia: si riscrive quella già salvata.
        const locked = openCount(k) > 0 && !!prev.name;
        const app = locked ? prev : { name: $('#f-app-' + k).value.trim().slice(0, 50), want: $('#f-want-' + k).value, cat: $('#f-cat-' + k).value, desc: $('#f-desc-' + k).value.trim().slice(0, 500) };
        const lk = locked ? linkFor(k) : $('#f-link-' + k).value.trim();
        if (k === 'main') { mainApp = app; mainLink = lk; } else if (app.name) { extra[k] = app; extraLinks[k] = lk; }
      }
      const data = { nick, country, bio: $('#f-bio').value.trim().slice(0, 200), app: mainApp, createdAt: old.createdAt || Date.now(), updatedAt: Date.now() };
      if (Object.keys(extra).length) data.extra = extra;
      if (old.spent && old.spent.length) data.spent = old.spent;
      if (old.moons) data.moons = old.moons;
      if (old.testing) data.testing = old.testing;
      if (old.moonsSpent) data.moonsSpent = old.moonsSpent;
      await setDoc(doc(db, 'users', me), data);
      const priv = { email, link: mainLink }; if (Object.keys(extraLinks).length) priv.extraLinks = extraLinks;
      await setDoc(doc(db, 'userPrivate', me), priv);
      const counted = await recordInvite(old, !!mainApp.name);
      toast(counted ? 'Profilo salvato. Il tuo invito è stato registrato: grazie!' : (mainApp.name ? 'Profilo salvato' : 'Profilo salvato. Aggiungi la tua app per comparire in Esplora.'));
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
  let paidFirst = true;
  dataUnsubs.push(onSnapshot(doc(db, 'paid', me), sn => {
    const n = sn.exists() ? Math.max(0, Math.floor(+sn.data().slots || 0)) : 0;
    if (!paidFirst && n > paidSlots()) toast('Pagamento confermato! Slot extra sbloccato: aggiungi la nuova app dal Profilo.');
    paidFirst = false; S.paid = n; render();
  }, () => { S.paid = 0; }));
  dataUnsubs.push(onSnapshot(doc(db, 'slotRequests', me), sn => { S.slotReq = sn.exists() ? sn.data() : null; render(); }, () => { S.slotReq = null; }));
  if (isAdminUser()) dataUnsubs.push(onSnapshot(collection(db, 'slotRequests'), sn => { S.reqs = new Map(sn.docs.map(d => [d.id, read(d)])); render(); }, () => { S.reqs = new Map(); }));
  dataUnsubs.push(onSnapshot(doc(db, 'refs', me), sn => { S.myRef = sn.exists() ? sn.data() : null; }, () => { S.myRef = null; }));
  dataUnsubs.push(onSnapshot(query(collection(db, 'refs'), where('by', '==', me)), sn => { S.refs = new Map(sn.docs.map(d => [d.id, read(d)])); render(); }, () => { /* senza inviti non c'è nulla da mostrare */ }));
  dataUnsubs.push(onSnapshot(doc(db, 'userPrivate', me), sn => { S.priv = sn.exists() ? sn.data() : { email: '' }; loaded.priv = true; render(); }, toastErr));
}
function stopData() { dataUnsubs.forEach(u => u()); dataUnsubs = []; msgWatch.forEach(u => u()); msgWatch.clear(); S.lastMsg = new Map(); stopSubs(); S.users = new Map(); S.swaps = new Map(); S.fb = new Map(); S.priv = { email: '' }; S.refs = new Map(); S.myRef = undefined; S.paid = 0; S.slotReq = undefined; S.reqs = new Map(); closeSlot(); Object.keys(loaded).forEach(k => { loaded[k] = false; }); firstRoute = false; S.route = null; S.tab = 'explore'; S.delOpen = false; }

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
