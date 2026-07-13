import React, { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Plus, Trash2, Pencil, ChevronLeft, Check, TrendingUp, TrendingDown, Dumbbell, Clock, X, Minus, Home as HomeIcon } from "lucide-react";
import * as db from "./data";

function formatTempo(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatData(iso) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

// ---------- Timer di recupero ----------
function RestTimerGauge({ totale, onClose }) {
  const [rimasti, setRimasti] = useState(totale);
  useEffect(() => {
    if (rimasti <= 0) return;
    const t = setTimeout(() => setRimasti((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [rimasti]);

  const pct = rimasti / totale;
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
      <button className="rest-gauge-close" onClick={onClose} aria-label="Chiudi timer"><X size={12} /></button>
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
    onLocalUpdate({ tipo: "toggleSerie", serie, esercizio });
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
  const salvaRecupero = (val) => {
    onLocalUpdate({ tipo: "aggiornaEsercizio", esercizioId: esercizio.id, campi: { recupero: val } });
  };

  return (
    <div className="ex-card">
      <div className="ex-head">
        <div>
          <div className="ex-name">{esercizio.nome}</div>
          {editRecupero ? (
            <input
              className="ex-rest-input" type="number" autoFocus
              defaultValue={esercizio.recupero}
              onBlur={(e) => { salvaRecupero(+e.target.value); setEditRecupero(false); }}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            />
          ) : (
            <button className="ex-rest" onClick={() => setEditRecupero(true)}>
              <Clock size={12} /> {formatTempo(esercizio.recupero)} recupero
            </button>
          )}
        </div>
        <div className="ex-head-actions">
          {timerAttivo && <RestTimerGauge totale={timerAttivo.totale} onClose={timerAttivo.onClose} />}
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

// ---------- Vista scheda ----------
function VistaScheda({ scheda, libreria, onBack, onMutate }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [timers, setTimers] = useState({});

  const startRest = (id, totale) => setTimers((t) => ({ ...t, [id]: { totale } }));

  return (
    <div className="view">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}><ChevronLeft size={18} /> Schede</button>
        <div className="topbar-title">{scheda.nome}</div>
        <div style={{ width: 70 }} />
      </div>

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
          timerAttivo={
            timers[es.id]
              ? { totale: timers[es.id].totale, onClose: () => setTimers((t) => { const c = { ...t }; delete c[es.id]; return c; }) }
              : null
          }
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

  // nota: il timer di recupero parte davvero quando una serie passa a "fatta":
  // lo lanciamo dal componente padre App tramite onMutate -> onStartRestReale
}

// ---------- Vista lista schede ----------
function VistaSchede({ schede, onOpen, onCreate, onDelete, onRename }) {
  const [rinomina, setRinomina] = useState(null);
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
                <><div className="scheda-name">{s.nome}</div><div className="scheda-meta">{s.esercizi.length} esercizi</div></>
              )}
            </button>
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setRinomina(s.id); }} aria-label="Rinomina"><Pencil size={14} /></button>
            <button className="icon-btn icon-btn--danger" onClick={(e) => { e.stopPropagation(); onDelete(s.id); }} aria-label="Elimina"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button className="add-ex-btn" onClick={onCreate}><Plus size={16} /> Nuova scheda</button>
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

function VistaEsercizi({ libreria, tuttiLog, onOpen, onDelete }) {
  return (
    <div className="view">
      <div className="topbar topbar--flat"><div className="topbar-title topbar-title--left">Libreria esercizi</div></div>
      {libreria.length === 0 && (
        <div className="empty-state"><Dumbbell size={28} /><p>Aggiungi un esercizio a una scheda: comparirà qui automaticamente.</p></div>
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
  const totSerie = schede.reduce((acc, s) => acc + s.esercizi.reduce((a, e) => a + e.serie.length, 0), 0);
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
          <div className="home-hero-sub">{suggerita.esercizi.length} esercizi &middot; inizia ora</div>
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
                <div className="scheda-meta">{s.esercizi.length} esercizi</div>
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
  const [realRestTimer, setRealRestTimer] = useState(null);

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

  // gestisce tutte le mutazioni di scheda/esercizi/serie in un unico posto
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
          if (nuovoStato) setRealRestTimer({ esercizioId: azione.esercizio.id, totale: azione.esercizio.recupero, key: Date.now() });
          break;
        }
        default:
          break;
      }
      await ricaricaTutto();
    } catch (e) {
      setErrore(e.message || "Operazione non riuscita");
    }
  };

  const createScheda = async () => {
    const s = await db.creaScheda("Nuova scheda");
    await ricaricaTutto();
    setSchedaAperta(s.id);
  };
  const deleteScheda = async (id) => { await db.eliminaScheda(id); await ricaricaTutto(); };
  const renameScheda = async (id, nome) => { await db.rinominaScheda(id, nome); await ricaricaTutto(); };

  if (caricamento) {
    return (
      <div className="app-root">
        <style>{css}</style>
        <div className="loading-screen"><Dumbbell size={26} /><p>Carico i tuoi dati...</p></div>
      </div>
    );
  }

  return (
    <div className="app-root">
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
  );
}

const css = `
:root {
  --bg: #1b1e26;
  --card: #252a34;
  --line: #3a4150;
  --text: #eef0f4;
  --text-dim: #8b93a3;
  --accent: #3e8ef7;
  --accent-soft: rgba(62,142,247,0.14);
  --good: #4fb787;
  --ember: #ff9f43;
  --danger: #e5484d;
}
* { box-sizing: border-box; }
.app-root { background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; min-height: 100vh; position: relative; display: flex; flex-direction: column; }
.view { padding: 16px 16px 90px; flex: 1; overflow-y: auto; }
.loading-screen { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color: var(--text-dim); }
.error-banner { background: rgba(229,72,77,0.12); color: var(--danger); border-bottom: 1px solid rgba(229,72,77,0.3); padding: 10px 16px; font-size: 12.5px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.error-banner button { background: none; border: none; color: var(--danger); cursor: pointer; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 18px; }
.topbar--flat { justify-content: flex-start; padding-top: 8px; }
.topbar-title { font-family: 'Oswald', 'Arial Narrow', sans-serif; font-weight: 600; font-size: 18px; letter-spacing: 0.02em; text-transform: uppercase; }
.topbar-title--left { font-size: 24px; }
.back-btn { display: flex; align-items: center; background: none; border: none; color: var(--text-dim); font-size: 13px; cursor: pointer; gap: 2px; }
.back-btn:hover { color: var(--text); }
.schede-list { display: flex; flex-direction: column; gap: 10px; }
.scheda-row { display: flex; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 4px; gap: 4px; }
.scheda-row-main { flex: 1; text-align: left; background: none; border: none; color: var(--text); padding: 12px 10px; cursor: pointer; }
.scheda-name { font-weight: 600; font-size: 15px; }
.scheda-meta { color: var(--text-dim); font-size: 12px; margin-top: 2px; font-family: 'Roboto Mono', monospace; }
.scheda-rename-input { background: var(--bg); border: 1px solid var(--accent); border-radius: 6px; padding: 6px 8px; color: var(--text); font-size: 14px; width: 90%; }
.icon-btn { background: none; border: none; color: var(--text-dim); padding: 8px; cursor: pointer; border-radius: 8px; display: flex; }
.icon-btn:hover { color: var(--text); background: var(--line); }
.icon-btn--danger:hover { color: var(--danger); }
.add-ex-btn { width: 100%; margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 6px; background: transparent; border: 1.5px dashed var(--line); color: var(--text-dim); padding: 13px; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 500; }
.add-ex-btn:hover { border-color: var(--accent); color: var(--accent); }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-dim); padding: 40px 20px; text-align: center; font-size: 13.5px; }
.ex-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.ex-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
.ex-name { font-weight: 700; font-size: 15.5px; }
.ex-rest { display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--ember); font-size: 12px; padding: 3px 0; cursor: pointer; font-family: 'Roboto Mono', monospace; }
.ex-rest-input { background: var(--bg); border: 1px solid var(--ember); color: var(--ember); border-radius: 6px; width: 60px; padding: 2px 6px; font-size: 12px; font-family: 'Roboto Mono', monospace; }
.ex-head-actions { display: flex; align-items: center; gap: 6px; }
.rest-gauge { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
.rest-gauge-label { position: absolute; font-family: 'Roboto Mono', monospace; font-size: 11px; font-weight: 700; color: var(--text); }
.rest-gauge-close { position: absolute; top: -4px; right: -4px; background: var(--line); border: none; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; color: var(--text-dim); cursor: pointer; }
.serie-header { display: grid; grid-template-columns: 26px 20px 1fr 1fr 26px; gap: 6px; padding: 0 2px; margin-bottom: 4px; color: var(--text-dim); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; font-family: 'Roboto Mono', monospace; }
.serie-row { display: grid; grid-template-columns: 26px 20px 1fr 1fr 26px; gap: 6px; align-items: center; padding: 5px 2px; border-radius: 8px; }
.serie-row--done { background: rgba(79,183,135,0.08); }
.serie-check { width: 22px; height: 22px; border-radius: 6px; border: 1.5px solid var(--line); background: var(--bg); display: flex; align-items: center; justify-content: center; color: var(--good); cursor: pointer; }
.serie-row--done .serie-check { background: var(--good); border-color: var(--good); color: #14161a; }
.serie-idx { color: var(--text-dim); font-size: 12px; font-family: 'Roboto Mono', monospace; text-align: center; }
.serie-field { display: flex; align-items: center; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 0 8px; }
.serie-field input { background: none; border: none; color: var(--text); width: 100%; padding: 7px 2px; font-family: 'Roboto Mono', monospace; font-size: 13.5px; }
.serie-field input:focus { outline: none; }
.serie-unit { color: var(--text-dim); font-size: 10.5px; }
.serie-del { background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.serie-del:hover { color: var(--danger); }
.add-serie { width: 100%; margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 5px; background: none; border: none; color: var(--text-dim); padding: 8px; cursor: pointer; font-size: 12.5px; border-top: 1px dashed var(--line); }
.add-serie:hover { color: var(--accent); }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: flex-end; justify-content: center; z-index: 30; }
.modal { background: var(--card); border: 1px solid var(--line); border-radius: 16px 16px 0 0; padding: 18px; width: 100%; max-width: 480px; max-height: 70%; display: flex; flex-direction: column; }
.modal-title { font-weight: 700; font-size: 16px; margin-bottom: 12px; }
.modal-input { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 11px 12px; color: var(--text); font-size: 14px; width: 100%; }
.modal-input:focus { outline: none; border-color: var(--accent); }
.modal-suggest-label { color: var(--text-dim); font-size: 11px; text-transform: uppercase; margin: 14px 0 6px; letter-spacing: 0.04em; }
.modal-suggest-list { display: flex; flex-direction: column; overflow-y: auto; gap: 2px; }
.modal-suggest-item { text-align: left; background: none; border: none; color: var(--text); padding: 9px 6px; border-radius: 8px; cursor: pointer; font-size: 13.5px; }
.modal-suggest-item:hover { background: var(--line); }
.modal-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn-ghost { flex: 1; background: none; border: 1px solid var(--line); color: var(--text-dim); padding: 11px; border-radius: 10px; cursor: pointer; font-size: 14px; }
.btn-primary { flex: 1; background: var(--accent); border: none; color: #10131a; padding: 11px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 14px; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.ex-lib-list { display: flex; flex-direction: column; gap: 8px; }
.ex-lib-row { display: flex; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 4px 6px 4px 4px; gap: 4px; }
.ex-lib-row-main { flex: 1; display: flex; align-items: center; justify-content: space-between; background: none; border: none; text-align: left; cursor: pointer; padding: 9px 10px; }
.ex-lib-row:hover { border-color: var(--text-dim); }
.ex-lib-name { font-weight: 600; font-size: 14.5px; }
.ex-lib-sub { color: var(--text-dim); font-size: 12px; margin-top: 2px; font-family: 'Roboto Mono', monospace; }
.ex-lib-delta { font-size: 12.5px; font-family: 'Roboto Mono', monospace; color: var(--text-dim); display: flex; align-items: center; gap: 3px; }
.ex-lib-delta.up { color: var(--good); }
.ex-lib-delta.down { color: var(--danger); }
.trend-banner { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
.trend-banner--up { background: rgba(79,183,135,0.12); color: var(--good); }
.trend-banner--down { background: rgba(229,72,77,0.1); color: var(--danger); }
.trend-banner--flat { background: var(--card); color: var(--text-dim); }
.chart-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 6px 4px; margin-bottom: 16px; }
.log-list-title { font-size: 11px; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.04em; margin-bottom: 8px; }
.log-row { display: flex; justify-content: space-between; padding: 9px 4px; border-bottom: 1px solid var(--line); font-size: 13px; font-family: 'Roboto Mono', monospace; }
.log-val--dim { color: var(--text-dim); }
.bottom-nav { display: flex; border-top: 1px solid var(--line); background: var(--card); position: sticky; bottom: 0; padding-bottom: env(safe-area-inset-bottom); }
.nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; color: var(--text-dim); padding: 11px 0 13px; cursor: pointer; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; }
.nav-btn--active { color: var(--accent); }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
.stat-box { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 8px; text-align: center; }
.stat-num { font-family: 'Oswald', 'Arial Narrow', sans-serif; font-size: 22px; font-weight: 600; color: var(--accent); }
.stat-label { font-size: 10.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 2px; }
.home-hero { width: 100%; text-align: left; background: linear-gradient(135deg, var(--accent-soft), var(--card)); border: 1px solid var(--accent); border-radius: 14px; padding: 16px; cursor: pointer; margin-bottom: 10px; }
.home-hero-label { font-size: 11px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
.home-hero-title { font-family: 'Oswald', 'Arial Narrow', sans-serif; font-size: 21px; font-weight: 600; margin-top: 4px; }
.home-hero-sub { font-size: 12.5px; color: var(--text-dim); margin-top: 3px; }
.home-pr { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; background: rgba(79,183,135,0.08); border: 1px solid rgba(79,183,135,0.35); color: var(--good); border-radius: 12px; padding: 12px 14px; cursor: pointer; margin-bottom: 20px; }
.home-pr-title { font-size: 13.5px; font-weight: 600; color: var(--text); }
.home-pr-sub { font-size: 12px; color: var(--good); margin-top: 1px; }
.home-section-title { font-size: 11px; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.04em; margin-bottom: 8px; }
.scheda-row--home { text-align: left; cursor: pointer; padding: 12px 14px; }
`;