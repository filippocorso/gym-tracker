import { supabase } from "./supabaseClient";

// ---------- Schede ----------
export async function fetchSchede() {
  const { data, error } = await supabase
    .from("schede")
    .select("*, esercizi(*, serie(*))")
    .order("created_at", { ascending: true });
  if (error) throw error;
  // ordina esercizi e serie client-side
  return (data || []).map((s) => ({
    ...s,
    esercizi: (s.esercizi || [])
      .sort((a, b) => a.ordine - b.ordine)
      .map((e) => ({ ...e, serie: (e.serie || []).sort((a, b) => a.ordine - b.ordine) })),
  }));
}

export async function creaScheda(nome) {
  const { data, error } = await supabase.from("schede").insert({ nome }).select().single();
  if (error) throw error;
  return data;
}

export async function rinominaScheda(id, nome) {
  const { error } = await supabase.from("schede").update({ nome }).eq("id", id);
  if (error) throw error;
}

export async function eliminaScheda(id) {
  const { error } = await supabase.from("schede").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Sessione allenamento ----------
// "Inizia allenamento": azzera eventuali spunte rimaste da una sessione
// precedente non terminata correttamente, poi segna la scheda come attiva.
export async function iniziaAllenamento(schedaId, esercizioIds) {
  if (esercizioIds.length > 0) {
    const { error: e1 } = await supabase.from("serie").update({ fatta: false }).in("esercizio_id", esercizioIds);
    if (e1) throw e1;
  }
  const { error: e2 } = await supabase.from("schede").update({ sessione_attiva: true }).eq("id", schedaId);
  if (e2) throw e2;
}

// "Termina allenamento": i carichi sono gia' salvati nello storico (avviene
// ad ogni spunta), qui azzeriamo solo le spunte per la prossima volta.
export async function terminaAllenamento(schedaId, esercizioIds) {
  if (esercizioIds.length > 0) {
    const { error: e1 } = await supabase.from("serie").update({ fatta: false }).in("esercizio_id", esercizioIds);
    if (e1) throw e1;
  }
  const { error: e2 } = await supabase.from("schede").update({ sessione_attiva: false }).eq("id", schedaId);
  if (e2) throw e2;
}

// ---------- Esercizi ----------
export async function aggiungiEsercizio(schedaId, nome, ordine) {
  const { data, error } = await supabase
    .from("esercizi")
    .insert({ scheda_id: schedaId, nome, recupero: 90, ordine })
    .select()
    .single();
  if (error) throw error;

  // upsert in libreria cosi' compare anche se non ha ancora storico
  await supabase.from("libreria_esercizi").upsert({ nome }, { onConflict: "nome" });

  // crea una prima serie vuota di default
  await supabase.from("serie").insert({ esercizio_id: data.id, peso: 20, reps: 8, ordine: 0 });

  return data;
}

export async function aggiornaEsercizio(id, campi) {
  const { error } = await supabase.from("esercizi").update(campi).eq("id", id);
  if (error) throw error;
}

export async function eliminaEsercizio(id) {
  const { error } = await supabase.from("esercizi").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Serie ----------
export async function aggiungiSerie(esercizioId, peso, reps, ordine) {
  const { error } = await supabase.from("serie").insert({ esercizio_id: esercizioId, peso, reps, ordine });
  if (error) throw error;
}

export async function aggiornaSerie(id, campi) {
  const { error } = await supabase.from("serie").update(campi).eq("id", id);
  if (error) throw error;
}

export async function eliminaSerie(id) {
  const { error } = await supabase.from("serie").delete().eq("id", id);
  if (error) throw error;
}

// segna la serie come fatta/non fatta. Quando diventa "fatta", registra
// automaticamente il carico nello storico dell'esercizio (libreria).
export async function toggleSerie(serieId, nuovoStato, esercizioNome, peso, reps) {
  const { error } = await supabase.from("serie").update({ fatta: nuovoStato }).eq("id", serieId);
  if (error) throw error;

  if (nuovoStato) {
    await supabase.from("libreria_esercizi").upsert({ nome: esercizioNome }, { onConflict: "nome" });
    const { error: logError } = await supabase
      .from("log_carichi")
      .insert({ esercizio_nome: esercizioNome, peso, reps, data: new Date().toISOString().slice(0, 10) });
    if (logError) throw logError;
  }
}

// ---------- Libreria esercizi ----------
export async function fetchLibreria() {
  const { data, error } = await supabase.from("libreria_esercizi").select("nome").order("nome");
  if (error) throw error;
  return (data || []).map((r) => r.nome);
}

export async function aggiungiEsercizioLibreria(nome) {
  const { error } = await supabase.from("libreria_esercizi").upsert({ nome }, { onConflict: "nome" });
  if (error) throw error;
}

// programma un messaggio Telegram che verra' spedito tra `secondiDaOra` secondi
// (gestito lato database da un cron job, funziona anche ad app chiusa)
export async function programmaNotificaTelegram(testo, secondiDaOra) {
  const invia_a = new Date(Date.now() + secondiDaOra * 1000).toISOString();
  const { error } = await supabase.from("notifiche_pending").insert({ testo, invia_a });
  if (error) throw error;
}

// ---------- Misure corporee ----------
export async function fetchMisure() {
  const { data, error } = await supabase.from("misure").select("*").order("data", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function aggiungiMisura(valori) {
  const { error } = await supabase.from("misure").insert(valori);
  if (error) throw error;
}

export async function eliminaMisura(id) {
  const { error } = await supabase.from("misure").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchLog(esercizioNome) {
  const { data, error } = await supabase
    .from("log_carichi")
    .select("*")
    .eq("esercizio_nome", esercizioNome)
    .order("data", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchTuttiILog() {
  const { data, error } = await supabase
    .from("log_carichi")
    .select("*")
    .order("data", { ascending: true });
  if (error) throw error;
  return data || [];
}

// rimuove l'esercizio dalla libreria insieme a tutto il suo storico carichi.
// non tocca gli esercizi eventualmente presenti dentro le schede: se in futuro
// completi una serie con lo stesso nome, ricomparira' automaticamente in libreria.
export async function eliminaDallaLibreria(nome) {
  const { error: e1 } = await supabase.from("log_carichi").delete().eq("esercizio_nome", nome);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("libreria_esercizi").delete().eq("nome", nome);
  if (e2) throw e2;
}