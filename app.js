import { firebaseConfig, TEST_DAYS } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, collection, doc, setDoc, updateDoc, addDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch, deleteDoc, getDocs, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import { setLangGetter, startI18n, applyDom, tr } from './i18n.js?v=20261103d';
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
const CATS = ['Giochi', 'Produttività', 'Social', 'Strumenti', 'Salute e fitness', 'Istruzione', 'Finanza', 'Altro'];
const COUNTRIES = ['Italia', 'Albania', 'Argentina', 'Australia', 'Austria', 'Belgio', 'Brasile', 'Canada', 'Cina', 'Croazia', 'Danimarca', 'Egitto', 'Filippine', 'Finlandia', 'Francia', 'Germania', 'Giappone', 'Grecia', 'India', 'Indonesia', 'Irlanda', 'Messico', 'Paesi Bassi', 'Polonia', 'Portogallo', 'Regno Unito', 'Romania', 'Spagna', 'Stati Uniti', 'Svezia', 'Svizzera', 'Turchia', 'Ucraina', 'Altro'];

const view = $('#view');
const S = { xt: 'all', hidden: new Set(), reports: new Map(), tab: 'explore', route: null, users: new Map(), swaps: new Map(), fb: new Map(), refs: new Map(), myRef: undefined, priv: { email: '' }, paid: 0, slotReq: undefined, reqs: new Map(), q: '', fc: '', star: {}, pick: {}, myEmail: undefined, theirEmail: undefined };
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
/* Una Luna al giorno solo se quel giorno hai aperto IronBlind (nessuna tolleranza). I giorni precedenti alla prima registrazione degli accessi valgono sempre. */
const dkey = t => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
function swapMoons(sw) {
  if (sw.status === 'declined') return 0;
  const el = elapsed(sw, me); if (el === null) return 0;
  const f = Math.min(14, Math.floor(el)); if (f < 1) return 0;
  const sn = (S.users.get(me) || {}).seen; if (!sn) return f;
  const b = new Date(ms(sw.start[me])); b.setHours(12, 0, 0, 0);
  let c = 0; for (let j = 1; j <= 14; j++) { const k = dkey(b.getTime() + j * DAY); if (k < (sn.since || 0) || (sn.days || []).indexOf(k) > -1) c++; }
  return Math.min(f, c);
}
function moonsEarned() {
  let n = 0;
  mine().forEach(sw => { n += swapMoons(sw); });
  return n;
}
/* Ultimo accesso di una persona: oggi, ieri o quanti giorni fa. */
function lastSeen(uid) {
  const a = ((S.users.get(uid) || {}).seen || {}).at; if (!a) return { t: 'mai', old: true };
  const d = Math.round((new Date().setHours(12, 0, 0, 0) - new Date(a).setHours(12, 0, 0, 0)) / DAY);
  return d <= 0 ? { t: 'oggi', old: false } : d === 1 ? { t: 'ieri', old: false } : { t: d + ' giorni fa', old: true };
}
const WELCOME_N = 100, WELCOME_MOONS = 20;
const bonusOf = u => Math.min(WELCOME_MOONS, Math.max(0, Math.floor(+(u && u.bonus) || 0)));
const moonBase = u => Math.max((u && u.moons) || 0, moonsEarned());
const moonTotal = u => moonBase(u) + bonusOf(u);
/* Posizione di iscrizione: quante persone con il profilo creato prima di me, più me. */
function joinRank(id) {
  const u = S.users.get(id), t = (u && u.createdAt) || 0; let n = 1;
  S.users.forEach((v, k) => { if (k === id || !v || !v.nick) return; const c = v.createdAt || 0; if (c < t || (c === t && k < id)) n++; });
  return n;
}
const welcomeKey = () => 'ironblind-welcome-' + me;
/* Tetto: si possono tenere al massimo 30 Lune; quelle in più si perdono (moonsLost non diminuisce mai, così il tetto non si aggira spendendo). */
const MOON_MAX = 30;
const moonLost = u => Math.max(0, Math.floor(+(u && u.moonsLost) || 0));
const moonBalance = u => Math.max(0, Math.min(MOON_MAX, moonTotal(u) - ((u && u.moonsSpent) || 0) - moonLost(u)));
const moonSlots = u => Math.floor(((u && u.moonsSpent) || 0) / MOON_COST);
const markers = u => ((u && u.spent) || []).filter(x => x === '#').length;
/* Slot extra = inviti non usati + slot ottenuti con le Lune o pagati, meno quelli già consumati (massimo 3 app extra). */
const otherCredits = u => Math.max(0, moonSlots(u) + paidSlots() - markers(u));
const creditsTotal = u => Math.min(MAX_EXTRA, validInvites().length + otherCredits(u));
const freeSlots = u => Math.max(0, creditsTotal(u) - extraCount(u));
const moonLabel = n => '🌕 ' + n + (n === 1 ? ' Luna' : ' Lune');
let moonWrite = false, pingOn = false;
/* Test in corso di una persona: scambi attivi in cui ha avviato il test e non ha ancora lasciato il feedback. */
const myTesting = () => mine().filter(sw => sw.status === 'active' && ms(sw.start && sw.start[me]) && !(sw.fb && sw.fb[me])).length;
/* Vetrina: app pubblicata su Google Play (link verificato solo nella forma) e app nel Cantiere (test in corso). */
const PLAY = /^https:\/\/play\.google\.com\//i;
const isPubApp = (uid, a) => !!(a && a.pub && PLAY.test(a.store || '') && !S.hidden.has(uid + '_' + a.id));
/* Test dell'app: scambi su IronBlind (prog) più eventuali tester esterni dichiarati dal proprietario (ext: n e data di inizio).
   Google Play conta i 14 giorni solo quando ci sono tutti e 12 i tester: il giorno 1 è quello in cui entra il dodicesimo. */
function buildInfo(a) {
  const p = (a && a.prog) || { n: 0, first: 0 }, e = a && a.ext && a.ext.n > 0 && a.ext.start ? a.ext : null;
  const en = e ? Math.min(50, Math.floor(e.n)) : 0;
  const st = (p.starts && p.starts.length) ? p.starts.slice() : (p.n && p.first ? new Array(Math.min(12, p.n)).fill(p.first) : []);
  for (let k = 0; k < Math.min(12, en); k++) st.push(e.start);
  st.sort((x, y) => x - y);
  const n = Math.max(st.length, (p.n || 0) + en), t12 = st.length >= 12 ? st[11] : 0, full = n >= 12 && t12 > 0;
  const finished = full && Date.now() - t12 >= 14 * DAY;
  const day = full ? Math.max(1, Math.min(14, Math.floor((Date.now() - t12) / DAY) + 1)) : 0;
  return { n, ext: en, full, finished, day };
}
const isBuildApp = (uid, a) => { const i = buildInfo(a); return !!(a && i.n > 0 && !i.finished && !S.hidden.has(uid + '_' + a.id)); };
const progDay = a => buildInfo(a).day;
/* Tester di una mia app: chi ha avviato il test; first = inizio del più vecchio test ancora in corso. */
function progOf(aid) {
  const t = []; mine().forEach(sw => { if (sw.status !== 'active' || aidOf(sw, me) !== aid) return; const o = sw.a === me ? sw.b : sw.a; const st = ms(sw.start && sw.start[o]); if (st) t.push(st); });
  t.sort((x, y) => x - y);
  if (!t.length) return { n: 0, starts: [] };
  return { n: t.length, starts: t.slice(0, 12) };
}
/* Salva nel profilo le Lune guadagnate e i test in corso, così si possono contare anche per la community. */
function syncMoons() {
  const u = S.users.get(me); if (!u || moonWrite || busy) return;
  const patch = {}; const t = moonsEarned(); if (t > (u.moons || 0)) patch.moons = t;
  const ex = moonTotal(u) - ((u.moonsSpent || 0)) - moonLost(u) - MOON_MAX; if (ex > 0) patch.moonsLost = moonLost(u) + ex;
  let welcome = false;
  if (loaded.users && u.nick && !u.bonus && joinRank(me) <= WELCOME_N) { patch.bonus = WELCOME_MOONS; welcome = true; }
  if (loaded.users && u.nick) {
    const now = Date.now(), tk = dkey(now), sn = u.seen || {}, days = sn.days || [];
    if (days.indexOf(tk) < 0) patch.seen = { at: now, since: sn.since || tk, days: days.concat(tk).slice(-40) };
    else if (now - (sn.at || 0) > 30 * 60 * 1000) patch.seen = { at: now, since: sn.since || tk, days };
  }
  const n = Math.min(100, myTesting()); if (n !== (u.testing || 0)) patch.testing = n;
  appsOf(me).forEach(a => {
    const p = progOf(a.id), o = a.prog || { n: 0, starts: [] };
    if (p.n !== (o.n || 0) || JSON.stringify(p.starts) !== JSON.stringify(o.starts || [])) patch[(a.id === 'main' ? 'app' : 'extra.' + a.id) + '.prog'] = p;
  });
  if (!Object.keys(patch).length) return;
  moonWrite = true;
  updateDoc(doc(db, 'users', me), patch).then(() => {
    if (!welcome) return;
    try { if (localStorage.getItem(welcomeKey())) return; localStorage.setItem(welcomeKey(), '1'); } catch (e) { /* senza memoria locale può ripetersi */ }
    setTimeout(() => showMilestone('welcome'), 500);
  }).catch(e => console.error(e)).finally(() => { moonWrite = false; });
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
  all[id] = { msg: Math.max(lm ? lm.at : 0, Date.now()), start: true, fb: true, acc: true, ready: true };
  try { localStorage.setItem(seenKey(), JSON.stringify(all)); } catch (e) { /* senza memoria locale gli avvisi restano finché non cambia lo stato */ }
}
function unreadInfo(s) {
  const seen = getSeen()[s.id] || {}; const o = s.a === me ? s.b : s.a; const out = []; const lm = S.lastMsg.get(s.id);
  const nMsg = lm ? lm.list.filter(m => m.from !== me && m.at > (seen.msg || 0)).length : 0;
  if (nMsg) out.push(nMsg === 1 ? 'Nuovo messaggio' : nMsg + ' nuovi messaggi');
  if (ms(s.start && s.start[o]) && !seen.start) out.push('Ha avviato il test');
  if (s.ready && s.ready[o] && !seen.ready && !ms(s.start && s.start[me])) out.push('Ti ha aggiunto ai tester');
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
      if (!first && d && d.from !== me) { if (!open) toast('Nuovo messaggio da ' + nameOf(d.from)); sysNotify('Nuovo messaggio da ' + nameOf(d.from), String(d.text || '').slice(0, 100), id); }
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
const fmtD = t => new Date(t).toLocaleDateString(lang() === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short' });
const fmtT = t => new Date(t).toLocaleTimeString(lang() === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
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
  const q = S.q.trim().toLowerCase(), tab = S.xt;
  const mineApps = appsOf(me);
  const arr = []; let hidden = 0;
  S.users.forEach((u, id) => {
    const own = id === me;
    if (own && tab === 'all') return;
    if (S.fc && u.country !== S.fc) return;
    appsOf(id).forEach(a => {
      if (tab === 'build' && !isBuildApp(id, a)) return;
      if (tab === 'pub' && !isPubApp(id, a)) return;
      if (q && (a.name + ' ' + (u.nick || '') + ' ' + (a.cat || '')).toLowerCase().indexOf(q) < 0) return;
      const ex = own ? null : swapForCard(id, a.id);
      const ok = !own && canTest(me, id, a.id) && (!mineApps.length || mineApps.some(m => canTest(id, me, m.id)));
      if (!own && !ex && !ok && tab !== 'pub') { hidden++; return; }
      arr.push({ id, u, a, ex, own, st: stats(id, a) });
    });
  });
  arr.sort((x, y) => y.st.done - x.st.done || (y.u.createdAt || 0) - (x.u.createdAt || 0));
  const note = hidden ? '<p class="small muted">' + hidden + (hidden === 1 ? ' app nascosta perché non è' : ' app nascoste perché non sono') + ' compatibili con i paesi richiesti da te o da loro.</p>' : '';
  if (!arr.length) {
    if (tab === 'build') return '<div class="empty"><h3>Nessun progetto nel Cantiere</h3><p class="muted">Quando uno sviluppatore avvia i 14 giorni di test, la sua app compare qui con la barra di avanzamento.</p></div>' + note;
    if (tab === 'pub') return '<div class="empty"><h3>Ancora nessuna app pubblicata</h3><p class="muted">Hai già pubblicato la tua app su Google Play? Vai nel Profilo, spunta «già pubblicata» e aggiungi il link: comparirà qui.</p></div>' + note;
    return '<div class="empty"><h3>Nessuna app da testare per ora</h3><p class="muted">' + (q || S.fc ? 'Prova con un altro nome, categoria o paese.' : 'Pubblica la tua app dal profilo e invita altri sviluppatori.') + '</p></div>' + note;
  }
  return arr.map(x => {
    let act = '', pickH = '';
    const pubd = isPubApp(x.id, x.a), build = isBuildApp(x.id, x.a);
    if (x.own) act = '';
    else if (!mineApps.length || !countryOk2()) act = '<button class="btn ghost" data-act="tab" data-tab="profile">Completa prima il tuo profilo</button>';
    else if (x.ex) act = '<button class="btn" data-act="swap" data-id="' + esc(x.ex.id) + '">Apri scambio</button>';
    else {
      const elig = mineApps.filter(m => canTest(x.id, me, m.id) && canTest(me, x.id, x.a.id) && !pairOpen(x.id, m.id, x.a.id));
      if (!elig.length) act = tab === 'pub' ? '' : '<p class="small muted">Nessuna delle tue app è compatibile o libera per questo scambio.</p>';
      else {
        const key = x.id + '-' + x.a.id; const cur = elig.find(m => m.id === S.pick[key]) || elig[0];
        if (elig.length > 1) pickH = '<label for="pick-' + esc(key) + '">Con quale tua app?<select class="pick" id="pick-' + esc(key) + '" data-key="' + esc(key) + '">' + elig.map(m => '<option value="' + esc(m.id) + '"' + (m.id === cur.id ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</select></label>';
        act = '<button class="btn primary" data-act="propose" data-id="' + esc(x.id) + '" data-oa="' + esc(x.a.id) + '" data-ma="' + esc(cur.id) + '">Proponi scambio 1 a 1</button>';
      }
    }
    let state = '', extra = '';
    if (pubd) {
      state = '<span class="pill ok">✅ Online su Google Play</span>';
      extra = '<div class="row"><a class="btn" style="text-decoration:none" target="_blank" rel="noopener noreferrer" href="' + esc(x.a.store) + '">▶ Vedi su Google Play</a>' + (x.own ? '' : '<button type="button" class="btn ghost sm" data-act="report" data-id="' + esc(x.id) + '" data-a="' + esc(x.a.id) + '">Segnala</button>') + '</div>';
    } else if (build) {
      state = '<span class="pill build">🚧 Nel Cantiere</span>';
      const bi = buildInfo(x.a), act2 = Math.max(0, Math.min(12, bi.n));
      const head = bi.full ? '<b>Giorno ' + bi.day + ' di 14</b><span class="muted">' + Math.round(bi.day / 14 * 100) + '%</span>' : '<b>' + act2 + ' tester su 12</b><span class="muted">' + Math.round(act2 / 12 * 100) + '%</span>';
      const w = bi.full ? Math.round(bi.day / 14 * 100) : Math.round(act2 / 12 * 100);
      extra = '<div><div class="row between small">' + head + '</div><div class="bar w" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + w + '"><i style="width:' + w + '%"></i></div></div>'
        + (bi.full ? '' : '<p class="small muted">Il conto dei 14 giorni parte quando ci sono tutti e 12 i tester.</p>')
        + '<div class="row between small"><span class="muted">Tester attivi</span><span class="tst" role="img" aria-label="' + act2 + ' tester attivi su 12">' + Array.from({ length: 12 }, (_, k) => '<i class="' + (k < act2 ? 'on' : '') + '"></i>').join('') + '</span></div>'
        + (bi.ext ? '<p class="small muted">di cui ' + bi.ext + (bi.ext === 1 ? ' esterno' : ' esterni') + '</p>' : '')
        + (x.own ? '' : '<div><button type="button" class="btn ghost sm" data-act="report" data-id="' + esc(x.id) + '" data-a="' + esc(x.a.id) + '">Segnala</button></div>');
    }
    return '<article class="card app' + xcls(x.a.id) + '"><div class="row between"><button class="who" data-act="user" data-id="' + esc(x.id) + '">' + av(x.id) + '<span class="n">' + esc(nameOf(x.id)) + '</span></button>' + rate(x.st) + '</div>'
      + '<div><div class="row" style="margin-bottom:4px"><span class="small muted mono">' + (isExtra(x.a.id) ? '' : '📱 ') + 'APP DA TESTARE</span>' + xtag(x.a.id) + (x.own ? '<span class="pill">La tua app</span>' : '') + state + '</div><h3 class="appname">' + esc(x.a.name) + '</h3><div class="row" style="margin-top:4px"><span class="chip">' + esc(x.a.cat || 'Altro') + '</span><span class="chip">' + esc(x.u.country || 'Paese n.d.') + '</span><span class="chip">Cerca: ' + esc(x.a.want || 'tutti i paesi') + '</span><span class="small muted">' + x.st.done + ' tester completati</span></div></div>'
      + (x.a.desc ? '<p class="desc">' + esc(x.a.desc) + '</p>' : '')
      + extra + pickH + (act ? '<div>' + act + '</div>' : '') + '</article>';
  }).join('') + note;
}
const countryOk2 = () => !!countryOf(me);
function xtabs() {
  let b = 0, p = 0; S.users.forEach((u, id) => appsOf(id).forEach(a => { if (isBuildApp(id, a)) b++; if (isPubApp(id, a)) p++; }));
  const t = [['all', 'Tutte', 0], ['build', '🚧 Il Cantiere', b], ['pub', '✅ Pubblicate', p]];
  return '<div class="seg" role="tablist" aria-label="Elenco app">' + t.map(x => '<button type="button" role="tab" aria-selected="' + (S.xt === x[0]) + '" class="' + (S.xt === x[0] ? 'on' : '') + '" data-act="xtab" data-t="' + x[0] + '">' + x[1] + (x[2] ? ' <span class="cnt">' + x[2] + '</span>' : '') + '</button>').join('') + '</div>';
}
function countryFilter() {
  const have = new Set(); S.users.forEach((u, id) => { if (id !== me && u.country && appsOf(id).length) have.add(u.country); });
  const list = COUNTRIES.filter(c => have.has(c) || c === S.fc);
  return '<label for="fc">Paese dello sviluppatore<select id="fc"><option value="">Tutti i paesi</option>' + list.map(c => '<option value="' + c + '"' + (c === S.fc ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>';
}
const fmtN = n => Number(n).toLocaleString(lang() === 'it' ? 'it-IT' : 'en-GB');
function statsBanner() {
  let devs = 0, apps = 0, tests = 0;
  S.users.forEach((u, id) => { if (!u || !u.nick) return; devs++; apps += appsOf(id).length; tests += id === me ? Math.min(100, myTesting()) : Math.min(100, Math.max(0, Math.floor(+u.testing || 0))); });
  const c = (x, n, l) => '<div class="sn" style="left:' + x + '%"><b>' + fmtN(n) + '</b><span>' + l + '</span></div>';
  return '<div class="stats" role="group" aria-label="' + fmtN(devs) + ' sviluppatori iscritti, ' + fmtN(tests) + ' test in corso, ' + fmtN(apps) + ' app pubblicate"><img src="contatore2.jpg" alt="" width="1600" height="888" decoding="async">'
    + c(46.3, devs, 'Sviluppatori<br>Iscritti') + c(67.4, tests, 'Test in<br>Corso') + c(88.5, apps, 'App<br>Pubblicate') + '</div>';
}
const exploreView = () => statsBanner() + xtabs() + '<div class="grid2"><label for="q">Cerca un\'app<input id="q" type="search" value="' + esc(S.q) + '" placeholder="Nome, categoria o sviluppatore"></label>' + countryFilter() + '</div><div id="list" class="stack">' + exploreItems() + '</div>' + inviteBox(true);

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
  const opts = CATS.map(c => '<option value="' + c + '"' + ((ap.cat || 'Altro') === c ? ' selected' : '') + '>' + c + '</option>').join('');
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
    + '<label for="f-desc-' + k + '">Cosa deve provare il tester<textarea id="f-desc-' + k + '" maxlength="500"' + dis + ' placeholder="Cosa fa l\'app e cosa vorresti che controllasse">' + esc(ap.desc || '') + '</textarea><span class="field-note" id="c-f-desc-' + k + '">' + (ap.desc || '').length + '/500</span></label>' + pubBox(k, ap) + conclude + '</div>';
}
const dateVal = t => { if (!t) return ''; const d = new Date(t), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
function extBox(k, ap) {
  const e = ap.ext || {};
  return '<div class="box"><b>Hai già un test attivo fuori da IronBlind?</b>'
    + '<div class="grid2"><label for="f-extn-' + k + '">Tester esterni<input id="f-extn-' + k + '" type="number" inputmode="numeric" min="0" max="50" value="' + (e.n > 0 ? e.n : '') + '" placeholder="0"></label>'
    + '<label for="f-exts-' + k + '">Data di inizio del test<input id="f-exts-' + k + '" type="date" max="' + dateVal(Date.now()) + '" value="' + dateVal(e.start) + '"></label></div>'
    + '<span class="field-note">Se hai già tester trovati altrove, l\'app compare nel Cantiere con il giorno di test. La data la trovi in Google Play Console. Resta un dato dichiarato da te.</span></div>';
}
function pubBox(k, ap) {
  if (!ap.name) return '';
  return extBox(k, ap) + '<div class="box"><label class="check" for="f-pub-' + k + '"><input type="checkbox" id="f-pub-' + k + '"' + (ap.pub ? ' checked' : '') + '><span>✅ Questa app è già pubblicata su Google Play</span></label>'
    + '<label for="f-store-' + k + '">Link su Google Play<input id="f-store-' + k + '" type="url" inputmode="url" maxlength="300" value="' + esc(ap.store || '') + '" placeholder="https://play.google.com/store/apps/details?id=..."><span class="field-note">Se la spunti, l\'app compare nella vetrina «Pubblicate» di Esplora.</span></label></div>';
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
    + (mineList.length ? mineList.map(a => statBlock(uid, a, mineList.length > 1)).join('') : statBlock(uid)) + '<section class="card"><h3>Feedback ricevuti</h3>' + fbList(uid) + '</section>' + (isAdminUser() ? '' : '');
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
/* ---------- Lingua e traguardi con il robottino ---------- */
const langKey = 'ironblind-lang';
function langPref() { try { const v = localStorage.getItem(langKey); return v === 'it' || v === 'en' ? v : 'auto'; } catch (e) { return 'auto'; } }
function lang() {
  const p = langPref(); if (p !== 'auto') return p;
  const n = (navigator.languages && navigator.languages[0]) || navigator.language || 'it';
  return /^it(\b|-|_)/i.test(n) ? 'it' : 'en';
}
setLangGetter(lang);
startI18n();
function langBox() {
  const p = langPref(), cur = lang() === 'it' ? 'italiano' : 'English';
  return '<section class="card"><h3>🌍 Lingua / Language</h3><p class="small muted">La lingua dell\'app e dei messaggi segue quella del telefono: italiano se è in italiano, altrimenti inglese. Ora: ' + cur + '.</p>'
    + '<label for="langsel">Lingua<select id="langsel"><option value="auto"' + (p === 'auto' ? ' selected' : '') + '>Automatica (segue il telefono)</option><option value="it"' + (p === 'it' ? ' selected' : '') + '>Italiano</option><option value="en"' + (p === 'en' ? ' selected' : '') + '>English</option></select></label>'
    + '<div><button type="button" class="btn ghost sm" data-act="msPreview">Vedi un messaggio di esempio</button></div></section>';
}
/* Ogni traguardo: chi parla (bot = robottino, boy = ragazzo con la sciarpa), titolo e battute in italiano e inglese. */
const MS = {
  first_swap: { t: ['Primo scambio!', 'First swap!'], l: [['bot', 'Bip bip! Due sviluppatori, due app, zero scuse. Il tuo primo scambio è partito: ora tocca a voi tenere gli occhi aperti.', 'Beep boop! Two developers, two apps, zero excuses. Your first swap is on: now keep your eyes open.']] },
  day7: { t: ['Metà strada!', 'Halfway there!'], l: [['bot', 'Giorno 7 su 14. Il tuo tester è ancora vivo e l\'app pure. Per ora, direi che va alla grande.', 'Day 7 of 14. Your tester is still alive and so is your app. So far, so good.']] },
  day14: { t: ['14 giorni completati!', '14 days done!'], l: [['boy', 'Ce l\'hai fatta! Quattordici giorni e nessun bug ti ha fermato. Ora lascia il feedback: il tuo tester se lo merita.', 'You made it! Fourteen days and no bug could stop you. Now leave your feedback: your tester earned it.']] },
  firstfb: { t: ['Primo feedback ricevuto', 'First feedback received'], l: [['boy', 'Qualcuno ha dedicato 14 giorni alla tua app e te l\'ha anche scritto. Dai un\'occhiata al tuo profilo.', 'Someone spent 14 days on your app and wrote it down. Check out your profile.']] },
  moons20: { t: ['20 Lune!', '20 Moons!'], l: [['bot', 'Hai raccolto 20 Lune. Valgono uno slot extra gratis: la pazienza paga, anche quando non sembrava.', 'You collected 20 Moons. That is a free extra slot: patience pays, even when it did not look like it.']] },
  tester6: { t: ['Sei a metà!', 'You are halfway!'], l: [['boy', '6 tester su 12. Il traguardo si vede già da qui. Non fermarti ora!', '6 testers out of 12. The finish line is already in sight. Do not stop now!']] },
  tester12: { big: true, t: ['12 tester su 12!', '12 testers out of 12!'], l: [
    ['bot', 'Bip bip! 12 tester su 12. Quasi non ci credo.', 'Beep boop! 12 testers out of 12. I can hardly believe it.'],
    ['boy', 'Ce l\'abbiamo fatta! Adesso Google Play non ha più scuse.', 'We did it! Google Play has no more excuses.'],
    ['bot', 'Vai a richiedere l\'accesso alla produzione. Noi facciamo il tifo da qui. 🚀', 'Go request production access. We will cheer from here. 🚀']] }
};
MS.welcome = { big: true, t: ['Benvenuto a bordo!', 'Welcome aboard!'], l: [
  ['bot', 'Bip bip! Sei tra i primi 100 sviluppatori di IronBlind. Per ringraziarti ti regaliamo 20 Lune: valgono uno slot extra gratis.', 'Beep boop! You are one of the first 100 developers on IronBlind. To thank you, here are 20 Moons: that is a free extra slot.'],
  ['boy', 'Grazie di esserci dall\'inizio: senza di te questa avventura non partirebbe. Benvenuto nell\'equipaggio!', 'Thank you for being here from the start: without you this adventure would not take off. Welcome to the crew!'],
  ['bot', 'Trovi le Lune nel tuo Profilo. Buon test! 🚀', 'You will find your Moons in your Profile. Happy testing! 🚀']] };
const MS_ORDER = ['tester12', 'tester6', 'moons20', 'firstfb', 'day14', 'day7', 'first_swap'];
const msStoreKey = () => 'ironblind-ms-' + me;
function msLoad() { try { const v = JSON.parse(localStorage.getItem(msStoreKey()) || 'null'); return v && Array.isArray(v.seen) ? v : null; } catch (e) { return null; } }
function msSave(v) { try { localStorage.setItem(msStoreKey(), JSON.stringify(v)); } catch (e) { /* senza memoria locale i traguardi si ripetono */ } }
/* Traguardi raggiunti adesso, calcolati solo da dati veri. */
function msReached() {
  const r = [];
  const my = mine().filter(s => s.status !== 'declined');
  if (my.some(s => s.status === 'active')) r.push('first_swap');
  my.forEach(s => { const el = elapsed(s, me); if (el !== null && el >= 7) r.push('day7:' + s.id); if (el !== null && el >= 14) r.push('day14:' + s.id); });
  let got = 0; S.fb.forEach(f => { if (f.to === me) got++; });
  if (got > 0) r.push('firstfb');
  if (moonBase(S.users.get(me)) >= 20) r.push('moons20');
  const best = Math.max(0, ...appsOf(me).map(a => stats(me, a).done));
  if (best >= 6) r.push('tester6');
  if (best >= 12) r.push('tester12');
  return r;
}
const msBase = k => k.split(':')[0];
function checkMilestones() {
  try {
    if (!me || !S.users.get(me) || $('#ms')) return;
    const reached = msReached(); let st = msLoad();
    if (!st) { msSave({ seen: reached }); return; } /* prima volta su questo dispositivo: niente raffica di messaggi vecchi */
    const fresh = reached.filter(k => st.seen.indexOf(k) < 0);
    if (!fresh.length) return;
    fresh.sort((x, y) => MS_ORDER.indexOf(msBase(x)) - MS_ORDER.indexOf(msBase(y)));
    const k = fresh[0]; st.seen.push(k); msSave(st); showMilestone(msBase(k));
  } catch (e) { /* un errore nei traguardi non deve bloccare l'app */ }
}
let msPrevI = 0;
function closeMs() { const m = $('#ms'); if (m) m.remove(); document.removeEventListener('keydown', msKey); }
function msKey(e) { if (e.key === 'Escape') closeMs(); }
function showMilestone(key) {
  const d = MS[key]; if (!d || $('#ms')) return;
  const i = lang() === 'it' ? 0 : 1, who = { bot: [i ? 'The little robot' : 'Il robottino', 'avatar-bot.png'], boy: [i ? 'The guy with the scarf' : 'Il ragazzo con la sciarpa', 'avatar-boy.png'] };
  const rows = d.l.map((x, n) => '<div class="ms-row ' + x[0] + '" style="animation-delay:' + (n * 0.9) + 's"><img class="ms-av" src="' + who[x[0]][1] + '" alt="' + esc(who[x[0]][0]) + '" width="56" height="56"><div class="ms-bubble">' + esc(x[1 + i]) + '</div></div>').join('');
  let conf = '';
  if (d.big && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    for (let n = 0; n < 28; n++) conf += '<i style="left:' + Math.round(Math.random() * 100) + '%;animation-delay:' + (Math.random() * 1.6).toFixed(2) + 's;background:' + ['#2748D8', '#1B8750', '#f3d77a', '#9DB2FF', '#fff'][n % 5] + '"></i>';
  }
  const bg = document.createElement('div'); bg.id = 'ms'; bg.className = 'modal-bg';
  bg.innerHTML = (conf ? '<div class="confetti" aria-hidden="true">' + conf + '</div>' : '') + '<div class="modal ms" role="dialog" aria-modal="true" aria-labelledby="ms-t"><h2 id="ms-t">' + esc(d.t[i]) + '</h2><div class="ms-chat">' + rows + '</div><button type="button" class="btn primary" data-act="msClose">' + (i ? 'Thanks!' : 'Grazie!') + '</button></div>';
  bg.addEventListener('click', e => { if (e.target === bg) closeMs(); });
  document.body.appendChild(bg); document.addEventListener('keydown', msKey);
  const b = bg.querySelector('[data-act="msClose"]'); if (b) b.focus();
}
document.addEventListener('change', e => { const t = e.target; if (t && t.id === 'langsel') { try { localStorage.setItem(langKey, t.value); } catch (x) { /* nessuna memoria locale */ } startI18n(); render(true); } });

/* ---------- Notifiche di sistema (solo con l'app aperta o in secondo piano) ---------- */
const notifKey = () => 'ironblind-notif-' + me;
const notifSupported = () => 'Notification' in window && 'serviceWorker' in navigator;
function notifOn() { try { return notifSupported() && Notification.permission === 'granted' && localStorage.getItem(notifKey()) === '1'; } catch (e) { return false; } }
function sysNotify(title, body, swapId) {
  try {
    if (!notifOn() || document.visibilityState !== 'hidden') return;
    navigator.serviceWorker.ready.then(reg => reg.showNotification(tr(title), {
      body: tr(body || ''), icon: 'icon-192.png', badge: 'icon-192.png', tag: 'swap-' + swapId, renotify: true, data: { swap: swapId }
    })).catch(() => { /* notifica non mostrata */ });
  } catch (e) { /* notifiche non disponibili */ }
}
function notify(text, swapId) { toast(text); sysNotify('IronBlind', text, swapId); }
async function enableNotif() {
  try {
    if (!notifSupported()) { toast('Questo browser non supporta le notifiche.'); return; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { toast('Permesso negato. Puoi attivarlo dalle impostazioni del sito nel browser.'); render(true); return; }
    try { localStorage.setItem(notifKey(), '1'); } catch (e) { /* senza memoria locale non resta attivo */ }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(tr('Notifiche attive'), { body: tr('Ti avviso di nuovi messaggi e richieste finché l\'app resta aperta.'), icon: 'icon-192.png', badge: 'icon-192.png', tag: 'ironblind-test' });
    toast('Notifiche attivate.');
  } catch (e) { toast('Non sono riuscito ad attivare le notifiche.'); }
  render(true);
}
function disableNotif() { try { localStorage.removeItem(notifKey()); } catch (e) { /* nulla */ } toast('Notifiche disattivate.'); render(true); }
function notifBox() {
  if (!notifSupported()) return '';
  const denied = Notification.permission === 'denied', on = notifOn();
  return '<section class="card"><div class="row between"><h3>🔔 Notifiche sul telefono</h3>' + (on ? '<span class="pill ok">Attive</span>' : '') + '</div>'
    + '<p class="small muted">Ricevi una notifica per nuovi messaggi, proposte e scambi accettati. Funziona finché l\'app è aperta o in secondo piano: se Android la chiude, non arrivano.</p>'
    + (denied ? '<p class="small">Le notifiche sono bloccate per questo sito: abilitale dalle impostazioni del browser.</p>'
      : '<div>' + (on ? '<button type="button" class="btn ghost" data-act="notifOff">Disattiva notifiche</button>' : '<button type="button" class="btn primary" data-act="notifOn">Attiva notifiche</button>') + '</div>')
    + '</section>';
}
let pendingSwap = null;
try { const q = new URLSearchParams(location.search).get('swap'); if (q) pendingSwap = q; } catch (e) { /* nessun parametro */ }
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* senza service worker niente notifiche di sistema */ });
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.swap) { pendingSwap = e.data.swap; openPendingSwap(); } });
  }
} catch (e) { /* ambiente senza service worker */ }
function openPendingSwap() {
  if (!pendingSwap || !me || !S.swaps.has(pendingSwap)) return;
  S.route = { t: 'swap', id: pendingSwap }; pendingSwap = null;
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* nulla */ }
  render(true);
}

function settingsView() {
  return '<section class="card"><h3>⚙️ Impostazioni</h3><p class="small muted">Notifiche, lingua, informazioni sull\'app e account.</p></section>'
    + notifBox() + langBox() + aboutBox()
    + '<section class="card"><h3>Seguici</h3><div class="row"><a class="btn ghost sm" target="_blank" rel="noopener noreferrer" href="https://www.instagram.com/ironblind_test_app">Instagram</a><a class="btn ghost sm" target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/share/18xtgUa4cQ/">Facebook</a></div></section>'
    + adminBox() + deleteBox()
    + '<section class="card"><button type="button" class="btn ghost" data-act="logout">Esci</button></section>';
}
function aboutBox() {
  return '<section class="card"><button type="button" class="menuitem" data-act="installOpen"><span class="row"><span aria-hidden="true">📱</span><b>Come installare l\'app</b></span><span aria-hidden="true">›</span></button>'
    + '<button type="button" class="menuitem" data-act="aboutOpen"><span class="row">' + ICON_INFO + '<b>Chi siamo</b></span><span aria-hidden="true">›</span></button>'
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
    + '<p class="small muted">Ogni giorno di test completato in cui accedi a IronBlind ti dà +1 Luna (massimo 14 per scambio). Con ' + MOON_COST + ' Lune sblocchi uno slot extra.</p>'
    + '<p class="small muted">Il massimo che puoi tenere è ' + MOON_MAX + ': oltre, le nuove Lune si perdono.</p><p class="small mono muted">' + bal + '/' + MOON_MAX + '</p>'
    + (can && bal >= MOON_MAX - 5 ? '<p class="small"><b>' + (bal >= MOON_MAX ? 'Sei al massimo: le nuove Lune si perdono finché non ne usi.' : 'Sei vicino al massimo: usa le Lune prima di perderle.') + '</b></p>' : '')
    + (can ? '<div><button type="button" class="btn primary" data-act="moonRedeem">Usa ' + MOON_COST + ' Lune per sbloccare uno Slot Extra</button></div>'
      : (bal >= MOON_COST ? '<p class="small muted">Hai già il massimo di slot extra.</p>' : '')) + '</div>';
}
/* ---------- Slot extra: Lune, inviti o pagamento ---------- */
function closeSlot() { const m = $('#slotm'); if (m) m.remove(); document.removeEventListener('keydown', slotKey); }
function slotKey(e) { if (e.key === 'Escape') closeSlot(); }
function openSlot() {
  closeSlot();
  const u = S.users.get(me) || {}; const bal = moonBalance(u); const code = esc(me);
  const optA = '<div class="step"><h3>🌕 Con le Lune (gratis)</h3><p class="small muted">Ogni giorno di test completato in cui accedi a IronBlind = +1 Luna. Hai ' + moonLabel(bal) + ': servono ' + MOON_COST + '.</p>'
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
  return '<section class="card"><h3>Richieste slot (solo tu)</h3>' + byCode + (l.length ? l.map(x => '<div class="box"><div class="row between"><b>' + esc(nameOf(x[0])) + '</b><span class="small muted">' + fmtD(x[1].at || Date.now()) + '</span></div><p class="small">PayPal: ' + esc(x[1].payer || 'non indicato') + '</p><code class="small" style="overflow-wrap:anywhere">' + esc(x[0]) + '</code><div class="row"><button type="button" class="btn primary sm" data-act="adminGrant" data-id="' + esc(x[0]) + '">Sblocca +1 slot</button><button type="button" class="btn ghost sm" data-act="adminDrop" data-id="' + esc(x[0]) + '">Elimina richiesta</button></div></div>').join('') : '<p class="small muted">Nessuna richiesta in attesa.</p>') + '</section>' + reportsBox();
}
function reportsBox() {
  const g = new Map(); S.reports.forEach(r => { const k = r.uid + '_' + r.aid; const e = g.get(k) || { uid: r.uid, aid: r.aid, n: 0 }; e.n++; g.set(k, e); });
  if (!g.size && !S.hidden.size) return '';
  const nm = (uid, aid) => { const a = appOf(uid, aid); return (a ? a.name : 'App') + ' · ' + nameOf(uid); };
  let h = '<section class="card"><h3>Vetrina: segnalazioni (solo tu)</h3>';
  g.forEach((e, k) => { const a = appOf(e.uid, e.aid); h += '<div class="box"><div class="row between"><b>' + esc(nm(e.uid, e.aid)) + '</b><span class="small muted">' + e.n + (e.n === 1 ? ' segnalazione' : ' segnalazioni') + '</span></div>' + (a && a.store ? '<p class="small" style="overflow-wrap:anywhere"><a href="' + esc(a.store) + '" target="_blank" rel="noopener noreferrer">' + esc(a.store) + '</a></p>' : '') + '<div class="row"><button type="button" class="btn primary sm" data-act="hideApp" data-k="' + esc(k) + '">Togli dalla vetrina</button><button type="button" class="btn ghost sm" data-act="dropReports" data-k="' + esc(k) + '">Ignora</button></div></div>'; });
  if (S.hidden.size) { h += '<p class="small muted">Tolte dalla vetrina</p>'; S.hidden.forEach(k => { const i = k.lastIndexOf('_'); h += '<div class="box"><div class="row between"><b>' + esc(nm(k.slice(0, i), k.slice(i + 1))) + '</b><button type="button" class="btn ghost sm" data-act="unhideApp" data-k="' + esc(k) + '">Rimetti in vetrina</button></div></div>'; }); }
  return h + '</section>';
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
function swapAppPicker(s, o) {
  if (s.status !== 'proposed' || s.a !== me) return '';
  const cur = aidOf(s, me), oA = aidOf(s, o);
  const opts = appsOf(me).filter(m => m.id === cur || (canTest(o, me, m.id) && canTest(me, o, oA) && !pairOpen(o, m.id, oA)));
  if (opts.length < 2) return '';
  return '<label for="swapapp">Cambia app<select id="swapapp" data-sid="' + esc(s.id) + '">' + opts.map(m => '<option value="' + esc(m.id) + '"' + (m.id === cur ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</select></label>';
}
async function changeSwapApp(sid, mA) {
  const s = S.swaps.get(sid); if (!s || s.status !== 'proposed' || s.a !== me || busy) return;
  const o = s.b, mineA = appOf(me, mA); if (!mineA) return;
  const lk = linkFor(mA);
  if (!lk) { toast('Aggiungi nel profilo il link di adesione al test di ' + mineA.name + '.'); render(true); return; }
  busy = true;
  try {
    const apps = Object.assign({}, s.apps); apps[me] = { name: mineA.name };
    const appIds = Object.assign({}, s.appIds || {}); appIds[me] = mA; appIds[o] = aidOf(s, o);
    await updateDoc(doc(db, 'swaps', sid), { apps, appIds });
    await setDoc(doc(db, 'swaps', sid, 'links', me), { link: lk });
    toast('App aggiornata');
  } catch (e) { toastErr(e); } finally { busy = false; render(true); }
}
function swapView(id) {
  const s = S.swaps.get(id) && Object.assign({ id }, S.swaps.get(id));
  const back = '<button class="btn ghost sm back" data-act="back">← Indietro</button>';
  if (!s) return back + '<div class="empty"><h3>Scambio non trovato</h3></div>';
  const o = s.a === me ? s.b : s.a;
  const oApp = (s.apps && s.apps[o]) || {}, mApp = (s.apps && s.apps[me]) || {};
  let h = back + '<div class="card"><div class="row between"><button class="who" data-act="user" data-id="' + esc(o) + '">' + av(o) + '<span class="n">' + esc(nameOf(o)) + '</span></button>' + statusPill(s) + '</div>'
    + (s.status === 'active' ? (() => { const ls = lastSeen(o); return '<div class="row" style="gap:6px"><span class="small muted">🕒 Ultimo accesso:</span><span class="pill ' + (ls.old ? 'warn' : 'ok') + '">' + ls.t + '</span></div>'; })() : '')
    + '<div class="box mini' + xcls(aidOf(s, o)) + '"><div class="row between"><span class="small muted mono">TU TESTI</span>' + xtag(aidOf(s, o)) + '</div><b>' + esc(oApp.name || 'App') + '</b>'
    + (s.status === 'active' ? (S.theirLink === undefined ? '<span class="small muted">Caricamento…</span>' : (S.theirLink ? link(S.theirLink) : '<span class="small muted">Il link di test non è disponibile.</span>')) : '<span class="small muted">Il link di test si sblocca quando lo scambio viene accettato.</span>') + '</div>'
    + '<div class="box mini' + xcls(aidOf(s, me)) + '"><div class="row between"><span class="small muted mono">LUI TESTA</span>' + xtag(aidOf(s, me)) + '</div><b>' + esc(mApp.name || 'La tua app') + '</b>' + swapAppPicker(s, o) + '</div></div>';
  if (s.status === 'proposed') {
    if (s.b === me) return h + '<div class="card"><p>' + esc(nameOf(o)) + ' propone di testarsi a vicenda.</p><div class="row"><button class="btn primary" data-act="accept" data-id="' + esc(id) + '">Accetta</button><button class="btn ghost" data-act="decline" data-id="' + esc(id) + '">Rifiuta</button></div></div>';
    return h + '<div class="card"><p>Richiesta inviata. Quando ' + esc(nameOf(o)) + ' accetta si apre la chat.</p><div><button class="btn ghost" data-act="decline" data-id="' + esc(id) + '">Annulla richiesta</button></div></div>';
  }
  const done = isDone(s);
  const mineE = S.myEmail, theirE = S.theirEmail;
  let step1 = '<div class="step"><h3><span class="k">1</span>Scambio delle email</h3>';
  if (mineE === undefined || (mineE && theirE === undefined)) {
    step1 += '<p class="small muted">Caricamento…</p>';
  } else if (mineE && theirE) {
    step1 += '<div class="box"><div class="mail"><span class="small muted">La tua</span><code>' + esc(mineE) + '</code></div><div class="mail"><span class="small muted">La sua</span><code>' + esc(theirE) + '</code><button class="btn sm" data-act="copy" data-text="' + esc(theirE) + '">Copia</button></div></div><p class="small muted">Aggiungi la sua email tra i tester della tua app in Play Console e usa il suo link per entrare nel test.</p>';
  } else {
    step1 += '<p class="small muted">' + (mineE ? 'Hai condiviso la tua email. Aspetta che lo faccia anche ' + esc(nameOf(o)) + ' per vedere la sua.' : 'Le email si vedono solo quando le condividete entrambi. La sua si sblocca dopo che hai condiviso la tua.') + '</p>';
    if (!mineE) step1 += S.priv.email ? '<div><button class="btn primary" data-act="shareEmail" data-id="' + esc(id) + '">Condividi la mia email</button></div>' : '<div><button class="btn" data-act="tab" data-tab="profile">Aggiungi la tua email nel profilo</button></div>';
  }
  if (!(s.ready && s.ready[me])) step1 += '<div class="box mini"><p class="small">Quando hai aggiunto la sua email tra i tester della tua app in Play Console, confermalo: solo allora ' + esc(nameOf(o)) + ' potrà installare e avviare il test.</p><div><button class="btn primary" data-act="ready" data-id="' + esc(id) + '">Ho aggiunto la sua email ai tester</button></div></div>';
  else step1 += '<p class="small"><span class="pill ok">✓ Hai aggiunto ' + esc(nameOf(o)) + ' ai tester</span></p>';
  step1 += '</div>';
  const el = elapsed(s, me), oel = elapsed(s, o);
  let step2 = '<div class="step"><h3><span class="k">2</span>Test di 14 giorni</h3>'
    + '<div class="stack" style="gap:6px"><div class="row between"><b class="small">Tu su ' + esc(oApp.name || 'la sua app') + '</b><span class="small mono muted">' + esc(dayLabel(el)) + '</span></div>' + tracker(el) + '</div>'
    + '<div class="stack" style="gap:6px"><div class="row between"><b class="small">Lui su ' + esc(mApp.name || 'la tua app') + '</b><span class="small mono muted">' + esc(dayLabel(oel)) + '</span></div>' + tracker(oel) + '</div>';
  if (el !== null && !done) {
    const mm = swapMoons(s), fl = Math.min(14, Math.floor(el)), lost = fl - mm;
    step2 += '<div class="row" style="gap:6px"><span class="small muted">' + moonLabel(mm) + ' in questo scambio</span>' + (lost > 0 ? '<span class="pill warn">' + lost + (lost === 1 ? ' giorno senza accesso' : ' giorni senza accesso') + '</span>' : '') + '</div>'
      + '<p class="small muted">Apri IronBlind ogni giorno: la Luna del giorno si ottiene solo se quel giorno accedi.</p>';
  }
  const rdy = !!(s.ready && s.ready[o]);
  if (el === null) step2 += S.theirLink === undefined ? '<p class="small muted">Caricamento…</p>' : !S.theirLink
    ? '<p class="small muted">Potrai avviare il test quando avrai il link dell\'app da installare.</p>'
    : (rdy ? '<div><button class="btn primary" data-act="startTest" data-id="' + esc(id) + '">Ho installato l\'app, avvia i 14 giorni</button></div>'
      : '<p class="small muted">Prima di installare aspetta che ' + esc(nameOf(o)) + ' ti aggiunga ai tester di Play Console: il pulsante di avvio si sblocca dopo la sua conferma.</p>');
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
  syncWatch(); syncMoons(); setTimeout(checkMilestones, 400);
  if (!pingOn) { pingOn = true; setInterval(() => { if (me && !document.hidden) syncMoons(); }, 10 * 60 * 1000); document.addEventListener('visibilitychange', () => { if (me && !document.hidden) syncMoons(); }); }
  const rec = mine().filter(s => (s.status === 'proposed' && s.b === me) || (s.status !== 'declined' && unreadOf(s).length)).length;
  document.title = (rec ? '(' + rec + ') ' : '') + 'IronBlind Test App';
  $('#navin').innerHTML = [['explore', 'Esplora'], ['swaps', 'Scambi'], ['profile', 'Profilo'], ['settings', 'Impostazioni']].map(t => '<button class="navb' + (S.tab === t[0] && !S.route ? ' on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + (t[0] === 'swaps' && rec ? '<span class="dot">' + rec + '</span>' : '') + '</button>').join('');
  $('#nav').hidden = false; $('#out').hidden = true;
  let h = '';
  if (S.route && S.route.t === 'user') h += S.route.id === me ? profileView(me, true) : profileView(S.route.id, false);
  else if (S.route && S.route.t === 'swap') h += swapView(S.route.id);
  else if (S.tab === 'explore') h += exploreView();
  else if (S.tab === 'swaps') h += swapsView();
  else if (S.tab === 'settings') h += settingsView();
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
    if (act === 'msClose') { closeMs(); return; }
    if (act === 'setLang') { try { localStorage.setItem(langKey, b.dataset.l); } catch (x) { /* nessuna memoria locale */ } startI18n(); render(true); return; }
    if (act === 'msPreview') { const ks = Object.keys(MS); showMilestone(ks[msPrevI++ % ks.length]); return; }
    if (act === 'notifOn') { enableNotif(); return; }
    if (act === 'notifOff') { disableNotif(); return; }
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
      const url = inviteLink(), text = tr('Ti invito su IronBlind Test App: ci scambiamo i test di 14 giorni per le nostre app Android.');
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
      await updateDoc(doc(db, 'users', me), { moonsSpent: (u.moonsSpent || 0) + MOON_COST, moons: moonBase(u) });
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
    } else if (act === 'xtab') {
      S.xt = b.dataset.t || 'all'; render(true); return;
    } else if (act === 'report') {
      const tid = b.dataset.id, ta = b.dataset.a || 'main';
      await setDoc(doc(db, 'reports', me + '_' + tid + '_' + ta), { uid: tid, aid: ta, by: me, at: Date.now() });
      toast('Segnalazione inviata. Grazie!');
    } else if (act === 'hideApp') {
      if (!isAdminUser()) return;
      await setDoc(doc(db, 'hidden', b.dataset.k), { at: Date.now() });
      const dels = []; S.reports.forEach((r, rid) => { if (r.uid + '_' + r.aid === b.dataset.k) dels.push(deleteDoc(doc(db, 'reports', rid))); }); await Promise.all(dels);
      toast('Tolta dalla vetrina');
    } else if (act === 'unhideApp') {
      if (!isAdminUser()) return;
      await deleteDoc(doc(db, 'hidden', b.dataset.k)); toast('Rimessa in vetrina');
    } else if (act === 'dropReports') {
      if (!isAdminUser()) return;
      const dels = []; S.reports.forEach((r, rid) => { if (r.uid + '_' + r.aid === b.dataset.k) dels.push(deleteDoc(doc(db, 'reports', rid))); }); await Promise.all(dels);
      toast('Segnalazioni ignorate');
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
    } else if (act === 'ready') {
      await updateDoc(doc(db, 'swaps', id), { ['ready.' + me]: true }); toast('Confermato: ora può installare e avviare il test');
    } else if (act === 'startTest') {
      if (!S.theirLink) { toast('Prima ti serve il link dell\'app da installare.'); return; }
      if (!(s.ready && s.ready[s.a === me ? s.b : s.a])) { toast('Aspetta che ti aggiunga ai tester.'); return; }
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
document.addEventListener('change', e => { const t = e.target; if (t && t.id === 'fc') { S.fc = t.value; const l = $('#list'); if (l) l.innerHTML = exploreItems(); } if (t && t.id === 'swapapp') changeSwapApp(t.dataset.sid, t.value); if (t && t.classList && t.classList.contains('pick')) S.pick[t.dataset.key] = t.value; });
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
    for (const k of ks) {
      const en = $('#f-extn-' + k); if (!en) continue; const n = en.value === '' ? 0 : Number(en.value), ds = $('#f-exts-' + k).value;
      if (!Number.isInteger(n) || n < 0 || n > 50) { toast('I tester esterni vanno da 0 a 50.'); return; }
      if (n > 0 && !ds) { toast('Indica la data di inizio del test esterno.'); return; }
      if (n > 0 && new Date(ds + 'T00:00:00').getTime() > Date.now()) { toast('La data di inizio non può essere nel futuro.'); return; }
    }
    for (const k of ks) { const pc = $('#f-pub-' + k), sl = $('#f-store-' + k); if (pc && pc.checked && !PLAY.test((sl && sl.value || '').trim())) { toast('Per la vetrina serve il link di Google Play (https://play.google.com/...)'); return; } }
    busy = true;
    try {
      const extra = {}, extraLinks = {}; let mainApp = null, mainLink = '';
      for (const k of ks) {
        const prev = Object.assign({}, k === 'main' ? (old.app || {}) : ((old.extra || {})[k] || {})); delete prev.link;
        // Con scambi aperti su quell'app non si cambia: si riscrive quella già salvata.
        const locked = openCount(k) > 0 && !!prev.name;
        const app = locked ? prev : { name: $('#f-app-' + k).value.trim().slice(0, 50), want: $('#f-want-' + k).value, cat: $('#f-cat-' + k).value, desc: $('#f-desc-' + k).value.trim().slice(0, 500) };
        const pc = $('#f-pub-' + k), sl = $('#f-store-' + k);
        if (pc) { const st = (sl ? sl.value.trim() : '').slice(0, 300); if (pc.checked) { app.pub = true; app.store = st; } else { delete app.pub; if (st) app.store = st; else delete app.store; } }
        const en = $('#f-extn-' + k);
        if (en) { const n = en.value === '' ? 0 : Number(en.value), ds = $('#f-exts-' + k).value; if (n > 0 && ds) app.ext = { n, start: new Date(ds + 'T00:00:00').getTime() }; else delete app.ext; }
        if (prev.prog) app.prog = prev.prog;
        const lk = locked ? linkFor(k) : $('#f-link-' + k).value.trim();
        if (k === 'main') { mainApp = app; mainLink = lk; } else if (app.name) { extra[k] = app; extraLinks[k] = lk; }
      }
      const data = { nick, country, bio: $('#f-bio').value.trim().slice(0, 200), app: mainApp, createdAt: old.createdAt || Date.now(), updatedAt: Date.now() };
      if (Object.keys(extra).length) data.extra = extra;
      if (old.spent && old.spent.length) data.spent = old.spent;
      if (old.moons) data.moons = old.moons;
      if (old.bonus) data.bonus = old.bonus;
      if (old.moonsLost) data.moonsLost = old.moonsLost;
      if (old.seen) data.seen = old.seen;
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
        if (!old) { if (s.b === me && s.status === 'proposed') notify(nameOf(s.a) + ' ti ha proposto uno scambio', id); return; }
        if (S.route && S.route.t === 'swap' && S.route.id === id) return;
        if (old.status === 'proposed' && s.status === 'active' && s.a === me) notify(nameOf(o) + ' ha accettato lo scambio', id);
        if (!ms(old.start && old.start[o]) && ms(s.start && s.start[o])) notify(nameOf(o) + ' ha avviato il test', id);
        if (!(old.ready && old.ready[o]) && s.ready && s.ready[o]) notify(nameOf(o) + ' ti ha aggiunto ai tester: ora puoi installare e avviare il test', id);
        if (!(old.fb && old.fb[o]) && s.fb && s.fb[o]) notify(nameOf(o) + ' ha lasciato il feedback', id);
      });
    }
    S.swaps = next; loaded.swaps = true; render(); openPendingSwap();
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
  dataUnsubs.push(onSnapshot(collection(db, 'hidden'), sn => { S.hidden = new Set(sn.docs.map(d => d.id)); render(); }, () => { S.hidden = new Set(); }));
  if (isAdminUser()) dataUnsubs.push(onSnapshot(collection(db, 'reports'), sn => { S.reports = new Map(sn.docs.map(d => [d.id, read(d)])); render(); }, () => { S.reports = new Map(); }));
  dataUnsubs.push(onSnapshot(doc(db, 'refs', me), sn => { S.myRef = sn.exists() ? sn.data() : null; }, () => { S.myRef = null; }));
  dataUnsubs.push(onSnapshot(query(collection(db, 'refs'), where('by', '==', me)), sn => { S.refs = new Map(sn.docs.map(d => [d.id, read(d)])); render(); }, () => { /* senza inviti non c'è nulla da mostrare */ }));
  dataUnsubs.push(onSnapshot(doc(db, 'userPrivate', me), sn => { S.priv = sn.exists() ? sn.data() : { email: '' }; loaded.priv = true; render(); }, toastErr));
}
function stopData() { dataUnsubs.forEach(u => u()); dataUnsubs = []; S.hidden = new Set(); S.reports = new Map(); msgWatch.forEach(u => u()); msgWatch.clear(); S.lastMsg = new Map(); stopSubs(); S.users = new Map(); S.swaps = new Map(); S.fb = new Map(); S.priv = { email: '' }; S.refs = new Map(); S.myRef = undefined; S.paid = 0; S.slotReq = undefined; S.reqs = new Map(); closeSlot(); Object.keys(loaded).forEach(k => { loaded[k] = false; }); firstRoute = false; S.route = null; S.tab = 'explore'; S.delOpen = false; }

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
