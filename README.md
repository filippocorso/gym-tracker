# Gym Tracker

App per tracciare schede, serie, carichi e recupero, con storico automatico
e grafici di progressione. Gratis al 100%: Supabase (database) + Vercel (hosting).

## 1. Crea il database su Supabase (5 minuti, gratis)

1. Vai su https://supabase.com → crea un account (puoi usare GitHub) → **New project**.
2. Scegli un nome, una password per il database (salvala da qualche parte) e la regione più vicina (Frankfurt va bene).
3. Aspetta che il progetto sia pronto, poi vai su **SQL Editor** (menu a sinistra) → **New query**.
4. Apri il file `supabase_schema.sql` incluso in questo progetto, copia tutto il contenuto, incollalo nell'editor e premi **Run**.
5. Vai su **Project Settings → API**. Ti servono due valori:
   - **Project URL** → va in `VITE_SUPABASE_URL`
   - **anon public key** → va in `VITE_SUPABASE_ANON_KEY`

## 2. Configura il progetto in locale

Serve Node.js installato (versione 18 o superiore). Se non ce l'hai: https://nodejs.org (scarica la LTS).

```bash
cd gym-app
npm install
cp .env.example .env
```

Apri `.env` e incolla i due valori presi da Supabase al punto 1.5.

Per provarla in locale sul PC:

```bash
npm run dev
```

Si apre su `http://localhost:5173`.

## 3. Metti l'app online con Vercel (gratis)

Il modo più semplice è caricare il progetto su GitHub e collegarlo a Vercel:

1. Crea un account su https://github.com (se non l'hai già) e crea un nuovo repository vuoto, es. `gym-tracker`.
2. Nella cartella del progetto:
   ```bash
   git init
   git add .
   git commit -m "prima versione"
   git branch -M main
   git remote add origin https://github.com/TUO-USERNAME/gym-tracker.git
   git push -u origin main
   ```
3. Vai su https://vercel.com → accedi con GitHub → **Add New → Project** → seleziona il repository `gym-tracker`.
4. Vercel riconosce automaticamente che è un progetto Vite. Prima di premere **Deploy**, apri **Environment Variables** e aggiungi:
   - `VITE_SUPABASE_URL` → il tuo Project URL
   - `VITE_SUPABASE_ANON_KEY` → la tua anon key
5. Premi **Deploy**. Dopo un minuto avrai un link tipo `https://gym-tracker-tuonome.vercel.app` — è la tua app, raggiungibile da qualsiasi dispositivo.

Ogni volta che vuoi aggiornare l'app (nuove modifiche), basta fare `git push`: Vercel la ripubblica da sola in automatico.

## 4. Installala sul tuo iPhone come un'app vera

1. Apri il link Vercel con **Safari** su iPhone (deve essere Safari, non Chrome).
2. Tocca l'icona **Condividi** (il quadrato con la freccia verso l'alto, in basso al centro).
3. Scorri e tocca **Aggiungi a Home**.
4. Conferma. Ora hai un'icona sulla home come qualsiasi altra app: si apre a schermo intero, senza barra di Safari, con la tua icona.

Da quel momento la usi come un'app normale — i dati sono sempre gli stessi perché vivono su Supabase, quindi funziona anche se la apri da PC, iPad o iPhone, sempre sincronizzata.

## Note

- L'app non ha login: chiunque abbia il link e la chiave può leggere/scrivere i dati. Per uso personale va benissimo, basta non condividere il link pubblicamente.
- Se in futuro vuoi condividerla con altri senza che vedano i tuoi dati, il prossimo passo è aggiungere autenticazione Supabase (email/password) — dimmelo quando vuoi e te la aggiungo.
