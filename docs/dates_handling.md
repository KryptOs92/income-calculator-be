# Date handling (UTC)

Questo backend tratta tutte le date come istanti UTC. Le colonne temporali sono di tipo `DATETIME(3)` e devono essere interpretate come UTC sia in lettura sia in scrittura.

## Formato richiesto dal client
- Invia sempre timestamp ISO 8601 con indicazione di fuso, es. `2025-11-25T14:30:00Z` o `2025-11-25T15:30:00+01:00`.
- Evita stringhe senza fuso (`2025-11-25 14:30:00`), perché i parser le assumono nel fuso del server/host e possono generare ambiguità.
- Non inviare millisecondi se non necessari, ma sono accettati (precisione fino a millisecondi). Esempio: `2025-11-25T14:30:00.123Z`.

## Come il server elabora le date
- I payload con date vengono convertiti con `new Date(value)`; quando includi un offset (`Z` o `+/-HH:MM`), l’istante è valutato correttamente in UTC.
- Se ometti una data opzionale e viene creato un record temporale, il server usa `new Date()` al momento della richiesta (orologio del server) e lo persiste come UTC.
- I campi `effectiveFrom`/`effectiveTo` sono memorizzati come istanti UTC. I controlli di validità (es. `effectiveTo > effectiveFrom`) sono fatti sugli istanti UTC risultanti.
- Le risposte JSON serializzano le date come stringhe ISO con `Z` (ad es. `2025-11-25T14:30:00.000Z`), quindi già in UTC.

## Campi rilevanti per le API
- Server nodes (creazione/aggiornamento): `powerEffectiveFrom`, `powerEffectiveTo`, `uptimeEffectiveFrom`, `uptimeEffectiveTo`, `energyRateEffectiveFrom`, `energyRateEffectiveTo`.
- Storico potenza (`/api/server-node-powers`): `effectiveFrom`, `effectiveTo`.
- Storico uptime (`/api/server-node-uptimes`): `effectiveFrom`, `effectiveTo`.
- Tariffe energia (`/api/energy-rates`): `effectiveFrom`, `effectiveTo`.

## Comportamento di default
- Se passi un valore (Wh, dailyUptimeSeconds o energyRateCostPerKwh) **senza** specificare le date, il server imposta `effectiveFrom` all’istante della richiesta (UTC) e lascia `effectiveTo = null`.
- Se passi date senza il relativo valore (es. `powerEffectiveFrom` senza `Wh`), il server rifiuta la richiesta (400) per evitare dati inconsistenti.

## Esempi

### Creazione di un server node con potenza e tariffa (date implicite, default = ora UTC)
```json
POST /api/server-nodes
{
  "name": "Validator EU-1",
  "Wh": 1200,
  "dailyUptimeSeconds": 82000,
  "energyRateCostPerKwh": "0.14",
  "energyRateCurrency": "EUR"
}
```
Risultato: `powerEffectiveFrom`, `uptimeEffectiveFrom`, `energyRateEffectiveFrom` vengono impostati all’orario corrente del server (UTC); i rispettivi `effectiveTo` restano `null`.

### Creazione di un server node con potenza datata nel passato
```json
POST /api/server-nodes
{
  "name": "Archive Node",
  "Wh": 900,
  "powerEffectiveFrom": "2025-10-01T00:00:00Z"
}
```
Risultato: crea il nodo e un record potenza con `effectiveFrom = 2025-10-01T00:00:00.000Z`. Nessun uptime o tariffa viene creato (non forniti).

### Inserimento di una voce nello storico potenza con intervallo esplicito
```json
POST /api/server-node-powers
{
  "serverNodeId": 42,
  "Wh": 1500,
  "effectiveFrom": "2025-12-01T00:00:00Z",
  "effectiveTo": "2026-01-01T00:00:00Z"
}
```
Risultato: salva l’intervallo in UTC; viene rifiutato se `effectiveTo` <= `effectiveFrom` o se esiste sovrapposizione con un altro intervallo del nodo.

### Tariffa energia con offset locale
```json
POST /api/energy-rates
{
  "serverNodeId": 42,
  "costPerKwh": "0.18",
  "currency": "EUR",
  "effectiveFrom": "2025-11-25T09:00:00+01:00"
}
```
`2025-11-25T09:00:00+01:00` è convertito in `2025-11-25T08:00:00.000Z` e salvato come tale.

## Raccomandazioni client
- Genera sempre date con `Z` o un offset, mai stringhe “naive”.
- Se devi mostrare date in un fuso locale, converti dal valore ISO UTC restituito dal server nel front-end (es. usando `Intl.DateTimeFormat`).
- Assicurati che l’orologio del client sia sincronizzato (NTP) se calcoli date di default lato client; in alternativa affida i default al server lasciando vuoti i campi opzionali.
