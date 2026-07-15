import React, { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Plus, Trash2, Pencil, ChevronLeft, Check, TrendingUp, TrendingDown, Dumbbell, Clock, X, Minus, Home as HomeIcon, Play, Square } from "lucide-react";
import * as db from "./data";

function formatTempo(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatData(iso) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function contaSerie(scheda) {
  return scheda.esercizi.reduce((a, e) => a + e.serie.length, 0);
}

// ---------- timer di recupero: persistenza locale (sopravvive a standby/riapertura app) ----------
function leggiTimerSalvato(esercizioId) {
  try {
    const raw = localStorage.getItem("restTimer_" + esercizioId);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.endAt) return null;
    return obj;
  } catch {
    return null;
  }
}
function scriviTimerSalvato(esercizioId, val) {
  try { localStorage.setItem("restTimer_" + esercizioId, JSON.stringify(val)); } catch {}
}
function rimuoviTimerSalvato(esercizioId) {
  try { localStorage.removeItem("restTimer_" + esercizioId); } catch {}
}

// ---------- notifiche di sistema, suono e vibrazione ----------
function chiediPermessoNotifiche() {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  } catch {}
}

// Funzione per riprodurre un segnale acustico (Beep) usando l'AudioContext del browser
function riproduciSuonoFineRecupero() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Primo bip
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // Nota La (A5) bella squillante
    gain1.gain.setValueAtTime(0.1, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.3);

    // Secondo bip (leggermente ritardato per fare un doppio "bip-bip")
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, ctx.currentTime);
      gain2.gain.setValueAtTime(0.1, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.3);
    }, 150);

  } catch (e) {
    console.log("AudioContext non avviabile:", e);
  }
}

async function notificaFineRecupero(nomeEsercizio) {
  // 1. Riproduci il suono (funziona sia su iOS che su Android)
  riproduciSuonoFineRecupero();

  // 2. Vibrazione (funziona su Android, ignorata su iOS)
  try { 
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]); 
    }
  } catch {}

  // 3. Notifica Push a schermo
  try {
    if ("Notification" in window && Notification.permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("Recupero terminato", {
        body: `${nomeEsercizio}: pronto per la prossima serie`,
        icon: "/icon-192.png",
        tag: "rest-timer",
      });
    }
  } catch {}
}

// ---------- Timer di recupero (gauge) ----------
function RestTimerGauge({ endAt, totale, nome, onFinish }) {
  const calcRimasti = () => Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const [rimasti, setRimasti] = useState(calcRimasti);
  const notificatoRef = useRef(false);

  useEffect(() => {
    const tick = () => setRimasti(calcRimasti());
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAt]);

  useEffect(() => {
    if (rimasti <= 0 && !notificatoRef.current) {
      notificatoRef.current = true;
      notificaFineRecupero(nome);
      const t = setTimeout(onFinish, 2200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rimasti]);

  const pct = Math.min(1, Math.max(0, rimasti / totale));
  const r = 26;
  const circ = 2 * Math.PI * r;
  const finito = rimasti <= 0;

  return (
    <div className="rest-gauge" role="status" aria-live="polite">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} stroke="var(--line)" strokeWidth="5" fill="none" />
        <circle
          cx="32" cy="32" r={r}
          stroke={finito ? "var(--good)" : "var(--ember)"}
          strokeWidth="5" fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="rest-gauge-label">{finito ? "GO" : formatTempo(rimasti)}</div>
      <button className="rest-gauge-close" onClick={onFinish} aria-label="Chiudi timer"><X size={12} /></button>
    </div>
  );
}

// ---------- Riga serie ----------
function RigaSerie({ serie, idx, onChange, onDelete, onToggle }) {
  return (
    <div className={`serie-row ${serie.fatta ? "serie-row--done" : ""}`}>
      <button className="serie-check" onClick={onToggle} aria-label="Segna serie completata">
        {serie.fatta && <Check size={13} strokeWidth={3} />}
      </button>
      <span className="serie-idx">{idx + 1}</span>
      <div className="serie-field">
        <input type="number" inputMode="decimal" value={serie.peso}
          onChange={(e) => onChange({ peso: e.target.value === "" ? null : +e.target.value })} />
        <span className="serie-unit">kg</span>
      </div>
      <div className="serie-field">
        <input type="number" inputMode="numeric" value={serie.reps}
          onChange={(e) => onChange({ reps: e.target.value === "" ? null : +e.target.value })} />
        <span className="serie-unit">reps</span>
      </div>
      <button className="serie-del" onClick={onDelete} aria-label="Elimina serie"><Minus size={14} /></button>
    </div>
  );
}

// ---------- Card esercizio ----------
function EsercizioCard({ esercizio, onLocalUpdate, onDelete, onStartRest, timerAttivo }) {
  const [editRecupero, setEditRecupero] = useState(false);

  const setSerieCampo = (serie, campi) => {
    onLocalUpdate({ tipo: "aggiornaSerie", serieId: serie.id, campi, esercizioId: esercizio.id });
  };
  const toggleSerie = (serie) => {
    const nuovoStato = !serie.fatta;
    onLocalUpdate({ tipo: "toggleSerie", serie, esercizio });
    if (nuovoStato) {
      chiediPermessoNotifiche();
      onStartRest(esercizio.id, esercizio.recupero, esercizio.nome);
    }
  };
  const delSerie = (serie) => {
    onLocalUpdate({ tipo: "eliminaSerie", serieId: serie.id, esercizioId: esercizio.id });
  };
  const addSerie = () => {
    const last = esercizio.serie[esercizio.serie.length - 1];
    onLocalUpdate({
      tipo: "aggiungiSerie",
      esercizioId: esercizio.id,
      peso: last?.peso ?? 20,
      reps: last?.reps ?? 8,
      ordine: esercizio.serie.length,
    });
  };
  const salvaRecuperoSecondi = (val) => {
    onLocalUpdate({ tipo: "aggiornaEsercizio", esercizioId: esercizio.id, campi: { recupero: val } });
  };

  return (
    <div className="ex-card">
      <div className="ex-head">
        <div>
          <div className="ex-name">{esercizio.nome}</div>
          {editRecupero ? (
            <div className="ex-rest-edit">
              <input
                className="ex-rest-input" type="number" step="0.5" min="0" autoFocus
                defaultValue={+(esercizio.recupero / 60).toFixed(2)}
                onBlur={(e) => {
                  const min = parseFloat(e.target.value);
                  salvaRecuperoSecondi(Math.max(0, Math.round((isNaN(min) ? 0 : min) * 60)));
                  setEditRecupero(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
              />
              <span className="ex-rest-edit-label">min</span>
            </div>
          ) : (
            <button className="ex-rest" onClick={() => setEditRecupero(true)}>
              <Clock size={12} /> {formatTempo(esercizio.recupero)} recupero
            </button>
          )}
        </div>
        <div className="ex-head-actions">
          {timerAttivo && (
            <RestTimerGauge
              key={timerAttivo.endAt}
              endAt={timerAttivo.endAt}
              totale={timerAttivo.totale}
              nome={esercizio.nome}
              onFinish={timerAttivo.onFinish}
            />
          )}
          <button className="icon-btn" onClick={onDelete} aria-label="Elimina esercizio"><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="serie-header"><span></span><span>#</span><span>Peso</span><span>Reps</span><span></span></div>
      {esercizio.serie.map((s, i) => (
        <RigaSerie key={s.id} serie={s} idx={i}
          onChange={(campi) => setSerieCampo(s, campi)}
          onDelete={() => delSerie(s)}
          onToggle={() => toggleSerie(s)}
        />
      ))}
      <button className="add-serie" onClick={addSerie}><Plus size={13} /> Aggiungi serie</button>
    </div>
  );
}

function ModalNuovoEsercizio({ libreria, onAdd, onClose }) {
  const [nome, setNome] = useState("");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Aggiungi esercizio</div>
        <input className="modal-input" placeholder="Nome esercizio..." value={nome}
          onChange={(e) => setNome(e.target.value)} autoFocus />
        {libreria.length > 0 && (
          <>
            <div className="modal-suggest-label">Dalla libreria</div>
            <div className="modal-suggest-list">
              {libreria.filter((n) => n.toLowerCase().includes(nome.toLowerCase())).map((n) => (
                <button key={n} className="modal-suggest-item" onClick={() => setNome(n)}>{n}</button>
              ))}
            </div>
          </>
        )}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn-primary" disabled={!nome.trim()} onClick={() => nome.trim() && onAdd(nome.trim())}>
            Aggiungi
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalNuovaScheda({ onCreate, onClose }) {
  const [nome, setNome] = useState("");
  const conferma = () => nome.trim() && onCreate(nome.trim());
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Nome della scheda</div>
        <input
          className="modal-input" placeholder="Es. Push Day, Gambe, Full Body..."
          value={nome} onChange={(e) => setNome(e.target.value)} autoFocus
          onKeyDown={(e) => e.key === "Enter" && conferma()}
        />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn-primary" disabled={!nome.trim()} onClick={conferma}>Crea</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Vista scheda ----------
function VistaScheda({ scheda, libreria, onBack, onMutate }) {
  const [modalOpen, setModalOpen] = useState(false);

  const [timers, setTimers] = useState(() => {
    const init = {};
    const sogliaScaduti = Date.now() - 5 * 60 * 1000;
    scheda.esercizi.forEach((es) => {
      const salvato = leggiTimerSalvato(es.id);
      if (salvato && salvato.endAt > sogliaScaduti) init[es.id] = salvato;
    });
    return init;
  });

  const startRest = (id, totaleSecondi, nome) => {
    const val = { endAt: Date.now() + totaleSecondi * 1000, totale: totaleSecondi, nome };
    scriviTimerSalvato(id, val);
    setTimers((t) => ({ ...t, [id]: val }));
  };
  const finishRest = (id) => {
    rimuoviTimerSalvato(id);
    setTimers((t) => { const c = { ...t }; delete c[id]; return c; });
  };

  const esercizioIds = scheda.esercizi.map((e) => e.id);
  const avviaAllenamento = () => onMutate({ tipo: "iniziaAllenamento", schedaId: scheda.id, esercizioIds });
  const terminaAllenamento = () => {
    esercizioIds.forEach(rimuoviTimerSalvato);
    setTimers({});
    onMutate({ tipo: "terminaAllenamento", schedaId: scheda.id, esercizioIds });
  };

  return (
    <div className="view">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}><ChevronLeft size={18} /> Schede</button>
        <div className="topbar-title">{scheda.nome}</div>
        <div style={{ width: 70 }} />
      </div>

      {scheda.sessione_attiva ? (
        <button className="session-btn session-btn--end" onClick={terminaAllenamento}>
          <Square size={16} /> Termina allenamento
        </button>
      ) : (
        <button className="session-btn session-btn--start" onClick={avviaAllenamento}>
          <Play size={16} /> Inizia allenamento
        </button>
      )}

      {scheda.esercizi.length === 0 && (
        <div className="empty-state"><Dumbbell size={28} /><p>Nessun esercizio in questa scheda.</p></div>
      )}

      {scheda.esercizi.map((es) => (
        <EsercizioCard
          key={es.id}
          esercizio={es}
          onDelete={() => onMutate({ tipo: "eliminaEsercizio", esercizioId: es.id })}
          onLocalUpdate={onMutate}
          onStartRest={startRest}
          timerAttivo={timers[es.id] ? { ...timers[es.id], onFinish: () => finishRest(es.id) } : null}
        />
      ))}

      <button className="add-ex-btn" onClick={() => setModalOpen(true)}><Plus size={16} /> Aggiungi esercizio</button>

      {modalOpen && (
        <ModalNuovoEsercizio
          libreria={libreria}
          onClose={() => setModalOpen(false)}
          onAdd={(nome) => { onMutate({ tipo: "aggiungiEsercizio", schedaId: scheda.id, nome, ordine: scheda.esercizi.length }); setModalOpen(false); }}
        />
      )}
    </div>
  );
}

// ---------- Vista lista schede ----------
function VistaSchede({ schede, onOpen, onCreate, onDelete, onRename }) {
  const [rinomina, setRinomina] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div className="view">
      <div className="topbar topbar--flat"><div className="topbar-title topbar-title--left">Le tue schede</div></div>
      {schede.length === 0 && (
        <div className="empty-state"><Dumbbell size={28} /><p>Ancora nessuna scheda. Creane una per iniziare.</p></div>
      )}
      <div className="schede-list">
        {schede.map((s) => (
          <div key={s.id} className="scheda-row">
            <button className="scheda-row-main" onClick={() => onOpen(s.id)}>
              {rinomina === s.id ? (
                <input className="scheda-rename-input" autoFocus defaultValue={s.nome}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => { onRename(s.id, e.target.value || s.nome); setRinomina(null); }}
                  onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
              ) : (
                <><div className="scheda-name">{s.nome}</div><div className="scheda-meta">{s.esercizi.length} esercizi &middot; {contaSerie(s)} serie</div></>
              )}
            </button>
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setRinomina(s.id); }} aria-label="Rinomina"><Pencil size={14} /></button>
            <button className="icon-btn icon-btn--danger" onClick={(e) => { e.stopPropagation(); onDelete(s.id); }} aria-label="Elimina"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button className="add-ex-btn" onClick={() => setModalOpen(true)}><Plus size={16} /> Nuova scheda</button>
      {modalOpen && (
        <ModalNuovaScheda
          onClose={() => setModalOpen(false)}
          onCreate={(nome) => { onCreate(nome); setModalOpen(false); }}
        />
      )}
    </div>
  );
}

// ---------- Vista dettaglio esercizio (grafico) ----------
function VistaEsercizioDettaglio({ nome, log, onBack }) {
  const storico = log.map((r) => ({ data: formatData(r.data), peso: r.peso, reps: r.reps }));
  const primo = storico[0]?.peso ?? 0;
  const ultimo = storico[storico.length - 1]?.peso ?? 0;
  const delta = +(ultimo - primo).toFixed(1);
  const migliora = delta > 0;
  const stabile = Math.abs(delta) < 0.5;

  return (
    <div className="view">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}><ChevronLeft size={18} /> Esercizi</button>
        <div className="topbar-title">{nome}</div>
        <div style={{ width: 70 }} />
      </div>

      {storico.length === 0 ? (
        <div className="empty-state"><Dumbbell size={28} /><p>Ancora nessun dato registrato per questo esercizio.<br />Completa una serie in una scheda per iniziare a tracciarlo.</p></div>
      ) : (
        <>
          <div className={`trend-banner ${stabile ? "trend-banner--flat" : migliora ? "trend-banner--up" : "trend-banner--down"}`}>
            {stabile ? <Dumbbell size={16} /> : migliora ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>
              {stabile ? "Carico stabile nel periodo" : migliora ? `In crescita: +${delta} kg da inizio periodo` : `In calo: ${delta} kg da inizio periodo`}
            </span>
          </div>

          <div className="chart-card">
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={storico} margin={{ top: 10, right: 16, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="data" stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} domain={["dataMin - 3", "dataMax + 3"]} />
                <ReferenceLine y={primo} stroke="var(--text-dim)" strokeDasharray="2 4" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--text-dim)" }} />
                <Line type="monotone" dataKey="peso" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="log-list">
            <div className="log-list-title">Storico</div>
            {[...storico].reverse().map((r, i) => (
              <div className="log-row" key={i}>
                <span className="log-date">{r.data}</span>
                <span className="log-val">{r.peso} kg</span>
                <span className="log-val log-val--dim">{r.reps} reps</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VistaEsercizi({ libreria, tuttiLog, onOpen, onDelete, onAdd }) {
  const [nuovo, setNuovo] = useState("");
  const conferma = () => {
    if (!nuovo.trim()) return;
    onAdd(nuovo.trim());
    setNuovo("");
  };
  return (
    <div className="view">
      <div className="topbar topbar--flat"><div className="topbar-title topbar-title--left">Libreria esercizi</div></div>
      <div className="new-ex-row">
        <input
          className="modal-input"
          placeholder="Nuovo esercizio da tracciare..."
          value={nuovo}
          onChange={(e) => setNuovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && conferma()}
        />
        <button className="btn-primary btn-primary--sm" disabled={!nuovo.trim()} onClick={conferma}>
          <Plus size={16} />
        </button>
      </div>
      {libreria.length === 0 && (
        <div className="empty-state"><Dumbbell size={28} /><p>Aggiungi un esercizio qui sopra, oppure comparirà da solo quando lo inserisci in una scheda.</p></div>
      )}
      <div className="ex-lib-list">
        {libreria.map((nome) => {
          const storico = tuttiLog.filter((r) => r.esercizio_nome === nome);
          const ultimo = storico[storico.length - 1];
          const delta = storico.length > 1 ? +(storico[storico.length - 1].peso - storico[0].peso).toFixed(1) : 0;
          return (
            <div key={nome} className="ex-lib-row">
              <button className="ex-lib-row-main" onClick={() => onOpen(nome)}>
                <div>
                  <div className="ex-lib-name">{nome}</div>
                  <div className="ex-lib-sub">{ultimo ? `${ultimo.peso} kg × ${ultimo.reps} reps` : "Nessun dato"}</div>
                </div>
                {storico.length > 1 && (
                  <div className={`ex-lib-delta ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}>
                    {delta > 0 && <TrendingUp size={13} />}{delta < 0 && <TrendingDown size={13} />}
                    {delta > 0 ? "+" : ""}{delta} kg
                  </div>
                )}
              </button>
              <button
                className="icon-btn icon-btn--danger"
                aria-label={`Elimina ${nome} dalla libreria`}
                onClick={() => {
                  if (window.confirm(`Eliminare "${nome}" dalla libreria? Anche lo storico dei carichi andrà perso.`)) {
                    onDelete(nome);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VistaHome({ schede, libreria, tuttiLog, onOpenScheda, onOpenEsercizio, onGoSchede }) {
  const totSerie = schede.reduce((acc, s) => acc + contaSerie(s), 0);
  const totEsercizi = schede.reduce((acc, s) => acc + s.esercizi.length, 0);
  const suggerita = schede.find((s) => s.esercizi.length > 0) || schede[0];

  let miglior = null;
  libreria.forEach((nome) => {
    const st = tuttiLog.filter((r) => r.esercizio_nome === nome);
    if (st.length > 1) {
      const delta = +(st[st.length - 1].peso - st[0].peso).toFixed(1);
      if (!miglior || delta > miglior.delta) miglior = { nome, delta, peso: st[st.length - 1].peso };
    }
  });

  return (
    <div className="view">
      <div className="topbar topbar--flat"><div className="topbar-title topbar-title--left">Bentornato</div></div>

      <div className="stats-row">
        <div className="stat-box"><div className="stat-num">{schede.length}</div><div className="stat-label">Schede</div></div>
        <div className="stat-box"><div className="stat-num">{totEsercizi}</div><div className="stat-label">Esercizi</div></div>
        <div className="stat-box"><div className="stat-num">{totSerie}</div><div className="stat-label">Serie totali</div></div>
      </div>

      {suggerita && (
        <button className="home-hero" onClick={() => onOpenScheda(suggerita.id)}>
          <div className="home-hero-label">Prossimo allenamento</div>
          <div className="home-hero-title">{suggerita.nome}</div>
          <div className="home-hero-sub">{suggerita.esercizi.length} esercizi &middot; {contaSerie(suggerita)} serie &middot; inizia ora</div>
        </button>
      )}

      {miglior && (
        <button className="home-pr" onClick={() => onOpenEsercizio(miglior.nome)}>
          <TrendingUp size={16} />
          <div>
            <div className="home-pr-title">Miglior progresso: {miglior.nome}</div>
            <div className="home-pr-sub">+{miglior.delta} kg &middot; ora a {miglior.peso} kg</div>
          </div>
        </button>
      )}

      {schede.length > 0 && (
        <>
          <div className="home-section-title">Tutte le schede</div>
          <div className="schede-list">
            {schede.map((s) => (
              <button key={s.id} className="scheda-row scheda-row--home" onClick={() => onOpenScheda(s.id)}>
                <div className="scheda-name">{s.nome}</div>
                <div className="scheda-meta">{s.esercizi.length} esercizi &middot; {contaSerie(s)} serie</div>
              </button>
            ))}
          </div>
        </>
      )}
      <button className="add-ex-btn" onClick={onGoSchede}>Gestisci schede</button>
    </div>
  );
}

// ---------- App ----------
export default function App() {
  const [tab, setTab] = useState("home");
  const [schede, setSchede] = useState([]);
  const [libreria, setLibreria] = useState([]);
  const [tuttiLog, setTuttiLog] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(null);

  const [schedaAperta, setSchedaAperta] = useState(null);
  const [esercizioAperto, setEsercizioAperto] = useState(null);
  const [logEsercizioAperto, setLogEsercizioAperto] = useState([]);

  const ricaricaTutto = useCallback(async () => {
    try {
      const [s, l, log] = await Promise.all([db.fetchSchede(), db.fetchLibreria(), db.fetchTuttiILog()]);
      setSchede(s);
      setLibreria(l);
      setTuttiLog(log);
      setErrore(null);
    } catch (e) {
      setErrore(e.message || "Errore di connessione a Supabase");
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => { ricaricaTutto(); }, [ricaricaTutto]);

  useEffect(() => {
    if (!esercizioAperto) return;
    db.fetchLog(esercizioAperto).then(setLogEsercizioAperto).catch((e) => setErrore(e.message));
  }, [esercizioAperto]);

  const scheda = schede.find((s) => s.id === schedaAperta);

  const onMutate = async (azione) => {
    try {
      switch (azione.tipo) {
        case "aggiungiEsercizio":
          await db.aggiungiEsercizio(azione.schedaId, azione.nome, azione.ordine);
          break;
        case "eliminaEsercizio":
          await db.eliminaEsercizio(azione.esercizioId);
          break;
        case "aggiornaEsercizio":
          await db.aggiornaEsercizio(azione.esercizioId, azione.campi);
          break;
        case "aggiungiSerie":
          await db.aggiungiSerie(azione.esercizioId, azione.peso, azione.reps, azione.ordine);
          break;
        case "aggiornaSerie":
          await db.aggiornaSerie(azione.serieId, azione.campi);
          break;
        case "eliminaSerie":
          await db.eliminaSerie(azione.serieId);
          break;
        case "toggleSerie": {
          const nuovoStato = !azione.serie.fatta;
          await db.toggleSerie(azione.serie.id, nuovoStato, azione.esercizio.nome, azione.serie.peso, azione.serie.reps);
          break;
        }
        case "iniziaAllenamento":
          await db.iniziaAllenamento(azione.schedaId, azione.esercizioIds);
          break;
        case "terminaAllenamento":
          await db.terminaAllenamento(azione.schedaId, azione.esercizioIds);
          break;
        default:
          break;
      }
      await ricaricaTutto();
    } catch (e) {
      setErrore(e.message || "Operazione non riuscita");
    }
  };

  const createScheda = async (nome) => {
    const s = await db.creaScheda(nome);
    await ricaricaTutto();
    setSchedaAperta(s.id);
  };
  const deleteScheda = async (id) => { await db.eliminaScheda(id); await ricaricaTutto(); };
  const renameScheda = async (id, nome) => { await db.rinominaScheda(id, nome); await ricaricaTutto(); };

  // swipe dal bordo sinistro verso destra per tornare indietro (come i gesti nativi iOS)
  const rootRef = useRef(null);
  const dentroUnaVista = !!(schedaAperta || esercizioAperto);
  useEffect(() => {
    if (!dentroUnaVista) return;
    const el = rootRef.current;
    if (!el) return;
    let startX = null;
    let startY = null;

    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (t.clientX < 28) { startX = t.clientX; startY = t.clientY; }
      else { startX = null; }
    };
    const onTouchEnd = (e) => {
      if (startX === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx > 65 && dy < 60) {
        if (esercizioAperto) setEsercizioAperto(null);
        else if (schedaAperta) setSchedaAperta(null);
      }
      startX = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [dentroUnaVista, esercizioAperto, schedaAperta]);

  if (caricamento) {
    return (
      <div className="page-shell">
        <div className="app-root">
          <style>{css}</style>
          <div className="loading-screen"><Dumbbell size={26} /><p>Carico i tuoi dati...</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="app-root" ref={rootRef}>
        <style>{css}</style>

        {errore && (
          <div className="error-banner">
            {errore}
            <button onClick={() => setErrore(null)}><X size={13} /></button>
          </div>
        )}

        {schedaAperta ? (
          <VistaScheda scheda={scheda} libreria={libreria} onBack={() => setSchedaAperta(null)} onMutate={onMutate} />
        ) : esercizioAperto ? (
          <VistaEsercizioDettaglio nome={esercizioAperto} log={logEsercizioAperto} onBack={() => setEsercizioAperto(null)} />
        ) : tab === "home" ? (
          <VistaHome schede={schede} libreria={libreria} tuttiLog={tuttiLog}
            onOpenScheda={setSchedaAperta} onOpenEsercizio={setEsercizioAperto} onGoSchede={() => setTab("schede")} />
        ) : tab === "schede" ? (
          <VistaSchede schede={schede} onOpen={setSchedaAperta} onCreate={createScheda} onDelete={deleteScheda} onRename={renameScheda} />
        ) : (
          <VistaEsercizi
            libreria={libreria}
            tuttiLog={tuttiLog}
            onOpen={setEsercizioAperto}
            onDelete={async (nome) => { await db.eliminaDallaLibreria(nome); await ricaricaTutto(); }}
            onAdd={async (nome) => { await db.aggiungiEsercizioLibreria(nome); await ricaricaTutto(); }}
          />
        )}

        {!schedaAperta && !esercizioAperto && (
          <nav className="bottom-nav">
            <button className={`nav-btn ${tab === "home" ? "nav-btn--active" : ""}`} onClick={() => setTab("home")}><HomeIcon size={18} /><span>Home</span></button>
            <button className={`nav-btn ${tab === "schede" ? "nav-btn--active" : ""}`} onClick={() => setTab("schede")}><Dumbbell size={18} /><span>Schede</span></button>
            <button className={`nav-btn ${tab === "esercizi" ? "nav-btn--active" : ""}`} onClick={() => setTab("esercizi")}><TrendingUp size={18} /><span>Esercizi</span></button>
          </nav>
        )}
      </div>
    </div>
  );
}

const css = `
:root {
  --bg: #14171d;
  --card: #20242d;
  --line: #343b48;
  --text: #f1f2f5;
  --text-dim: #8b93a3;
  --accent: #4a97ff;
  --accent-soft: rgba(74,151,255,0.16);
  --good: #4fb787;
  --ember: #ff9f43;
  --danger: #e5484d;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.page-shell { min-height: 100vh; width: 100%; background: var(--bg); display: flex; justify-content: center; }
.app-root { background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, sans-serif; width: 100%; max-width: 480px; min-height: 100vh; position: relative; display: flex; flex-direction: column; padding-top: env(safe-area-inset-top); }
.view { padding: 16px 16px 110px; flex: 1; overflow-y: auto; }
.loading-screen { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color: var(--text-dim); }
.error-banner { background: rgba(229,72,77,0.12); color: var(--danger); border-bottom: 1px solid rgba(229,72,77,0.3); padding: 10px 16px; font-size: 12.5px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.error-banner button { background: none; border: none; color: var(--danger); cursor: pointer; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 0 18px; min-height: 34px; }
.topbar--flat { justify-content: flex-start; padding-top: 18px; }
.topbar-title { font-family: 'Oswald', 'Arial Narrow', sans-serif; font-weight: 600; font-size: 18px; letter-spacing: 0.02em; text-transform: uppercase; }
.topbar-title--left { font-size: 26px; }
.back-btn { display: flex; align-items: center; background: none; border: none; color: var(--text-dim); font-size: 13px; cursor: pointer; gap: 2px; padding: 6px 4px; }
.back-btn:hover { color: var(--text); }
.schede-list { display: flex; flex-direction: column; gap: 10px; }
.scheda-row { display: flex; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 4px; gap: 4px; }
.scheda-row-main { flex: 1; text-align: left; background: none; border: none; color: var(--text); padding: 13px 12px; cursor: pointer; }
.scheda-name { font-weight: 600; font-size: 15px; }
.scheda-meta { color: var(--text-dim); font-size: 12px; margin-top: 3px; font-family: 'Roboto Mono', monospace; }
.scheda-rename-input { background: var(--bg); border: 1px solid var(--accent); border-radius: 10px; padding: 7px 10px; color: var(--text); font-size: 14px; width: 90%; }
.icon-btn { background: none; border: none; color: var(--text-dim); padding: 9px; cursor: pointer; border-radius: 12px; display: flex; }
.icon-btn:hover { color: var(--text); background: var(--line); }
.icon-btn--danger:hover { color: var(--danger); }
.add-ex-btn { width: 100%; margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 6px; background: transparent; border: 1.5px dashed var(--line); color: var(--text-dim); padding: 14px; border-radius: 18px; cursor: pointer; font-size: 14px; font-weight: 500; }
.add-ex-btn:hover { border-color: var(--accent); color: var(--accent); }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-dim); padding: 40px 20px; text-align: center; font-size: 13.5px; }
.ex-card { background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 16px; margin-bottom: 12px; }
.ex-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
.ex-name { font-weight: 700; font-size: 15.5px; }
.ex-rest { display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--ember); font-size: 12px; padding: 3px 0; cursor: pointer; font-family: 'Roboto Mono', monospace; }
.ex-rest-edit { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
.ex-rest-input { background: var(--bg); border: 1px solid var(--ember); color: var(--ember); border-radius: 8px; width: 56px; padding: 3px 7px; font-size: 12px; font-family: 'Roboto Mono', monospace; }
.ex-rest-edit-label { color: var(--text-dim); font-size: 11px; }
.ex-head-actions { display: flex; align-items: center; gap: 6px; }
.rest-gauge { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
.rest-gauge-label { position: absolute; font-family: 'Roboto Mono', monospace; font-size: 11px; font-weight: 700; color: var(--text); }
.rest-gauge-close { position: absolute; top: -4px; right: -4px; background: var(--line); border: none; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; color: var(--text-dim); cursor: pointer; }
.serie-header { display: grid; grid-template-columns: 26px 20px 1fr 1fr 26px; gap: 6px; padding: 0 2px; margin-bottom: 4px; color: var(--text-dim); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; font-family: 'Roboto Mono', monospace; }
.serie-row { display: grid; grid-template-columns: 26px 20px 1fr 1fr 26px; gap: 6px; align-items: center; padding: 5px 2px; border-radius: 12px; }
.serie-row--done { background: rgba(79,183,135,0.08); }
.serie-check { width: 22px; height: 22px; border-radius: 8px; border: 1.5px solid var(--line); background: var(--bg); display: flex; align-items: center; justify-content: center; color: var(--good); cursor: pointer; }
.serie-row--done .serie-check { background: var(--good); border-color: var(--good); color: #12151a; }
.serie-idx { color: var(--text-dim); font-size: 12px; font-family: 'Roboto Mono', monospace; text-align: center; }
.serie-field { display: flex; align-items: center; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 0 8px; }
.serie-field input { background: none; border: none; color: var(--text); width: 100%; padding: 7px 2px; font-family: 'Roboto Mono', monospace; font-size: 13.5px; }
.serie-field input:focus { outline: none; }
.serie-unit { color: var(--text-dim); font-size: 10.5px; }
.serie-del { background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.serie-del:hover { color: var(--danger); }
.add-serie { width: 100%; margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 5px; background: none; border: none; color: var(--text-dim); padding: 8px; cursor: pointer; font-size: 12.5px; border-top: 1px dashed var(--line); }
.add-serie:hover { color: var(--accent); }
.session-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 15px; border-radius: 18px; font-weight: 700; font-size: 14.5px; margin-bottom: 16px; cursor: pointer; border: none; }
.session-btn--start { background: var(--accent); color: #0d1117; }
.session-btn--end { background: rgba(229,72,77,0.14); color: var(--danger); border: 1px solid rgba(229,72,77,0.4); }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: flex-end; justify-content: center; z-index: 30; }
.modal { background: var(--card); border: 1px solid var(--line); border-radius: 26px 26px 0 0; padding: 20px; width: 100%; max-width: 480px; max-height: 70%; display: flex; flex-direction: column; }
.modal-title { font-weight: 700; font-size: 16px; margin-bottom: 12px; }
.modal-input { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; color: var(--text); font-size: 14px; width: 100%; }
.modal-input:focus { outline: none; border-color: var(--accent); }
.modal-suggest-label { color: var(--text-dim); font-size: 11px; text-transform: uppercase; margin: 14px 0 6px; letter-spacing: 0.04em; }
.modal-suggest-list { display: flex; flex-direction: column; overflow-y: auto; gap: 2px; }
.modal-suggest-item { text-align: left; background: none; border: none; color: var(--text); padding: 9px 6px; border-radius: 10px; cursor: pointer; font-size: 13.5px; }
.modal-suggest-item:hover { background: var(--line); }
.modal-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn-ghost { flex: 1; background: none; border: 1px solid var(--line); color: var(--text-dim); padding: 12px; border-radius: 14px; cursor: pointer; font-size: 14px; }
.btn-primary { flex: 1; background: var(--accent); border: none; color: #0d1117; padding: 12px; border-radius: 14px; cursor: pointer; font-weight: 700; font-size: 14px; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.ex-lib-list { display: flex; flex-direction: column; gap: 8px; }
.new-ex-row { display: flex; gap: 8px; margin-bottom: 16px; }
.btn-primary--sm { flex: none; padding: 12px 16px; display: flex; border-radius: 14px; }
.ex-lib-row { display: flex; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 4px 6px 4px 4px; gap: 4px; }
.ex-lib-row-main { flex: 1; display: flex; align-items: center; justify-content: space-between; background: none; border: none; text-align: left; cursor: pointer; padding: 10px 10px; }
.ex-lib-row:hover { border-color: var(--text-dim); }
.ex-lib-name { font-weight: 600; font-size: 14.5px; }
.ex-lib-sub { color: var(--text-dim); font-size: 12px; margin-top: 2px; font-family: 'Roboto Mono', monospace; }
.ex-lib-delta { font-size: 12.5px; font-family: 'Roboto Mono', monospace; color: var(--text-dim); display: flex; align-items: center; gap: 3px; }
.ex-lib-delta.up { color: var(--good); }
.ex-lib-delta.down { color: var(--danger); }
.trend-banner { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 16px; font-size: 13px; margin-bottom: 14px; }
.trend-banner--up { background: rgba(79,183,135,0.12); color: var(--good); }
.trend-banner--down { background: rgba(229,72,77,0.1); color: var(--danger); }
.trend-banner--flat { background: var(--card); color: var(--text-dim); }
.chart-card { background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 14px 6px 4px; margin-bottom: 16px; }
.log-list-title { font-size: 11px; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.04em; margin-bottom: 8px; }
.log-row { display: flex; justify-content: space-between; padding: 10px 6px; border-bottom: 1px solid var(--line); font-size: 13px; font-family: 'Roboto Mono', monospace; }
.log-val--dim { color: var(--text-dim); }
.bottom-nav { display: flex; gap: 4px; background: rgba(32,36,45,0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--line); border-radius: 26px; margin: 0 14px; padding: 6px; position: sticky; bottom: calc(14px + env(safe-area-inset-bottom)); box-shadow: 0 12px 30px rgba(0,0,0,0.4); }
.nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; color: var(--text-dim); padding: 10px 0 11px; cursor: pointer; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; border-radius: 20px; }
.nav-btn--active { color: var(--accent); background: var(--accent-soft); }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
.stat-box { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 14px 8px; text-align: center; }
.stat-num { font-family: 'Oswald', 'Arial Narrow', sans-serif; font-size: 22px; font-weight: 600; color: var(--accent); }
.stat-label { font-size: 10.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 2px; }
.home-hero { position: relative; overflow: hidden; width: 100%; text-align: left; background: linear-gradient(135deg, var(--accent-soft), var(--card)); border: 1px solid var(--accent); border-radius: 26px; padding: 18px; cursor: pointer; margin-bottom: 10px; }
.home-hero::before { content: ''; position: absolute; width: 200px; height: 200px; background: radial-gradient(circle, var(--accent) 0%, transparent 70%); opacity: 0.25; top: -70px; right: -50px; border-radius: 50%; pointer-events: none; }
.home-hero-label { position: relative; font-size: 11px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
.home-hero-title { position: relative; font-family: 'Oswald', 'Arial Narrow', sans-serif; font-size: 22px; font-weight: 600; margin-top: 4px; }
.home-hero-sub { position: relative; font-size: 12.5px; color: var(--text-dim); margin-top: 3px; }
.home-pr { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; background: rgba(79,183,135,0.08); border: 1px solid rgba(79,183,135,0.35); color: var(--good); border-radius: 18px; padding: 13px 16px; cursor: pointer; margin-bottom: 20px; }
.home-pr-title { font-size: 13.5px; font-weight: 600; color: var(--text); }
.home-pr-sub { font-size: 12px; color: var(--good); margin-top: 1px; }
.home-section-title { font-size: 11px; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.04em; margin-bottom: 8px; }
.scheda-row--home { text-align: left; cursor: pointer; padding: 13px 14px; }
`;