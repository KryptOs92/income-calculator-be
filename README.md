# income-calculator-be

## Email locale

Le API `POST /api/auth/register` e `POST /api/auth/request-password-reset` accettano un campo opzionale `locale` (`it` oppure `en`) per scegliere la lingua delle email inviate.

Imposta `FRONTEND_URL` nel file `.env` (default `http://localhost:5173`) per controllare il dominio utilizzato nei link di verifica e reset inviati via email.

Esempio registrazione in inglese:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "Password123!",
    "locale": "en"
  }'
```

Esempio richiesta reset in italiano (fallback predefinito):

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "locale": "it"
  }'
```

Se non viene indicato alcun `locale`, verrà usata la lingua italiana. Imposta la variabile d'ambiente `DEFAULT_LOCALE` per modificare il fallback globale.
