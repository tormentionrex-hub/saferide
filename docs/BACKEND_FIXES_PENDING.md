# Backend — Fixes y nuevos endpoints pendientes

> **Contexto:** este archivo apunta los cambios que se deben aplicar al repo
> `saferide-backend` cuando el equipo backend libere la rama (otro compañero
> está modificándolo en este momento).
>
> Cada item incluye: prioridad, archivos afectados, descripción del problema,
> solución técnica concreta, riesgo y orden recomendado de aplicación.
>
> **Status legend:** 🔴 crítico · 🟠 alto · 🟡 medio · 🟢 mejora

---

## ÍNDICE

- [Bloque 1 — Saneamiento (zero-risk, 1–2 días)](#bloque-1--saneamiento)
- [Bloque 2 — Reputación correcta (preparación SafeScore)](#bloque-2--reputación-correcta)
- [Bloque 3 — Seguridad](#bloque-3--seguridad)
- [Bloque 4 — Nuevos modelos SafeScore](#bloque-4--nuevos-modelos-safescore)
- [Bloque 5 — Nuevos endpoints SafeScore](#bloque-5--nuevos-endpoints-safescore)
- [Bloque 6 — Workers y cron jobs](#bloque-6--workers-y-cron-jobs)
- [Bloque 7 — Integraciones IA](#bloque-7--integraciones-ia)
- [Bloque 8 — Escalabilidad](#bloque-8--escalabilidad)
- [Bloque 9 — Tests](#bloque-9--tests)

---

# Bloque 1 — Saneamiento

## 1.1 🔴 Colapsar `cancelled` / `canceled` en `Booking.status`

**Archivo:** `src/models/Booking.js`
**Problema:** el enum acepta dos grafías para el mismo estado. Cualquier filtro
`{status: 'cancelled'}` omite la mitad de las reservas canceladas (las que
usan `canceled` single-L). Bug latente en reportes y métricas.

**Fix:**

```js
// ANTES
status: { type: String, enum: ['pending','confirmed','cancelled','canceled','completed','deny'] }

// DESPUÉS
status: { type: String, enum: ['pending','confirmed','cancelled','completed','deny'] }
```

**Migración necesaria** (script one-shot):

```js
// scripts/migrate_booking_status.js
await Booking.updateMany({ status: 'canceled' }, { $set: { status: 'cancelled' } });
```

**Actualizar también:** `src/controllers/bookingController.js` — buscar todas
las referencias a `'canceled'` (single-L) y dejar solo `'cancelled'`. Si la
ruta `PATCH /bookings/:id/canceled` se conserva como alias, internamente debe
escribir `cancelled`.

**Riesgo:** bajo si la migración corre antes de remover el enum.

---

## 1.2 🟡 Renombrar `Metics.js` → `Metrics.js`

**Archivo:** `src/models/Metics.js`
**Problema:** typo. Confunde búsqueda, IDE y onboarding.

**Fix:**

```bash
git mv src/models/Metics.js src/models/Metrics.js
```

Actualizar imports en:
- `src/jobs/calculateMetrics.js`
- `src/services/metricsService.js`
- `src/controllers/metricsController.js`
- `src/models/index.js`

Mongoose model name `'Metrics'` también debe ser revisado. **Si la colección
en Cosmos se llamó `metics` por el typo**, agregar `{ collection: 'metics' }`
explícito al schema para no romper datos existentes (o renombrar la colección
con un script `db.metics.renameCollection('metrics')`).

**Riesgo:** medio si los datos ya están en una colección con typo.

---

## 1.3 🔴 Activar `apiLimiter` en `app.js`

**Archivo:** `src/app.js`
**Problema:** rate limiting está comentado. Endpoints sensibles como
`POST /auth/login`, `POST /reviews`, `POST /auth/register` están sin throttle.

**Fix:**

```js
// src/app.js
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');

// Después de helmet/cors, antes de las rutas:
app.use('/api/v1/auth', authLimiter);   // más estricto (10 req/min)
app.use('/api/v1', apiLimiter);          // general (100 req/min)
```

**Verificar:** `src/middleware/rateLimiter.js` debe exportar ambos. Si solo
exporta `apiLimiter`, agregar `authLimiter` con `windowMs: 60_000, max: 10`.

**Riesgo:** muy bajo. Si causara problemas, se desactiva con env flag.

---

## 1.4 🟠 Agregar `requireActive` a `POST /reviews`

**Archivo:** `src/routes/reviewRoutes.js`
**Problema:** un usuario con `trustScore=0` (cuenta bloqueada) puede seguir
dejando reseñas — vector típico de retaliación.

**Fix:**

```js
const { verifyToken, requireActive } = require('../middleware/auth');

router.post('/', verifyToken, requireActive, reviewController.createReview);
router.post('/direct-submit', verifyToken, requireActive, reviewController.createReview);
```

**Riesgo:** ninguno.

---

## 1.5 🟢 Eliminar alias `POST /reviews/direct-submit`

**Archivo:** `src/routes/reviewRoutes.js`
**Problema:** dos rutas apuntan al mismo controller. El móvil
(`RatingScreen.js`) usa `/reviews/direct-submit`; el flujo "normal" usa
`/reviews`. Confusión sin razón documentada.

**Plan:**
1. Decidir una sola: `/reviews`.
2. Mantener el alias temporalmente con `console.warn('deprecated')` por 2 sprints.
3. Migrar móvil al nuevo endpoint (en `src/screens/shared/RatingScreen.js`,
   reemplazar con el endpoint canónico).
4. Eliminar el alias.

**Riesgo:** bajo si se hace por fases.

---

## 1.6 🟢 Eliminar `cleanup_db.js` del repo root del backend

**Archivo:** `saferide-backend/cleanup_db.js`
**Problema:** script destructivo a la vista, fuera de `scripts/`.

**Fix:** moverlo a `src/scripts/dev_cleanup_db.js` con guard `if (process.env.NODE_ENV !== 'development') process.exit(1);`.

---

# Bloque 2 — Reputación correcta

## 2.1 🔴 Reemplazar fórmula de rating `(sum+5)/(n+1)` por Bayesian average

**Archivo:** `src/controllers/reviewController.js` (función `createReview`)
**Problema:** la fórmula actual suma `+5` al numerador y `+1` al denominador en
cada recálculo. Esto:

- Infla artificialmente a nuevos usuarios.
- Hace que 100 reviews de 4★ den ~4.01 en lugar de 4.00.
- No tiene ponderación temporal (1★ de hace 2 años pesa lo mismo que ayer).

**Fix conceptual:**

```js
// src/services/reputationService.js (NUEVO ARCHIVO)

const PRIOR_MEAN = 4.0;     // media empírica esperada
const PRIOR_WEIGHT = 10;    // "votos virtuales" — atenúa cold start
const HALF_LIFE_DAYS = 180; // decay temporal

function bayesianAverage(values, prior = PRIOR_MEAN, weight = PRIOR_WEIGHT) {
  if (!values.length) return prior;
  const sum = values.reduce((a, b) => a + b, 0);
  return (prior * weight + sum) / (weight + values.length);
}

function applyDecay(reviews, halfLife = HALF_LIFE_DAYS) {
  const now = Date.now();
  return reviews.map(r => {
    const ageDays = (now - r.date.getTime()) / 86_400_000;
    const w = Math.pow(0.5, ageDays / halfLife);
    return { value: r.rating, weight: w };
  });
}

function weightedAverage(weighted, prior = PRIOR_MEAN, priorWeight = PRIOR_WEIGHT) {
  const sumW = weighted.reduce((a, x) => a + x.weight, 0);
  const sumWX = weighted.reduce((a, x) => a + x.weight * x.value, 0);
  return (prior * priorWeight + sumWX) / (priorWeight + sumW);
}

async function recomputeUserRating(userId) {
  const reviews = await Review.find({ reviewee_id: userId }).select('rating date');
  const decayed = applyDecay(reviews);
  const newRating = weightedAverage(decayed);
  await User.updateOne({ _id: userId }, { $set: { rating: Math.round(newRating * 100) / 100 } });
  return newRating;
}

module.exports = { recomputeUserRating, bayesianAverage, applyDecay, weightedAverage };
```

**Reemplazar en `reviewController.createReview`** el bloque actual que
calcula `(totalStars + 5) / (count + 1)` por:

```js
const { recomputeUserRating } = require('../services/reputationService');
// ...
await recomputeUserRating(reviewee_id);
```

**One-shot migration job** (recálculo histórico):

```js
// src/scripts/recompute_all_ratings.js
const User = require('../models/User');
const { recomputeUserRating } = require('../services/reputationService');

(async () => {
  await require('../config/database').connect();
  const users = await User.find({}, '_id');
  for (const u of users) {
    await recomputeUserRating(u._id);
  }
  console.log(`Recomputed ${users.length} users`);
  process.exit(0);
})();
```

**Riesgo:** medio. Algunos usuarios verán su rating bajar (los que estaban
artificialmente inflados). Comunicar al equipo de producto antes del deploy.

---

## 2.2 🟠 Cambiar `User.rating` default de `5` a `null` (o `undefined`)

**Archivo:** `src/models/User.js`
**Problema:** todos los nuevos usuarios muestran 5.00★ sin haber recibido
reseñas. Falsa señal de calidad.

**Fix:**

```js
rating: { type: Number, min: 0, max: 5, default: null }
```

**Móvil/Admin** deben mostrar "Sin calificaciones aún" si `rating === null`.

---

## 2.3 🟠 Bloquear borrado de reseñas por el autor

**Archivo:** `src/controllers/reviewController.js` (función `deleteReview`)
**Problema:** el autor de una reseña la puede borrar. Esto permite que un
usuario que dio 1★ "lave" su reseña si el reviewee lo presiona o le pide.

**Fix:**

```js
// ANTES: if (review.reviewer_id.equals(req.user._id) || req.user.type === 'admin')
// DESPUÉS:
if (req.user.type !== 'admin') {
  return res.status(403).json({ message: 'Solo administradores pueden eliminar reseñas. Si quieres reportar una reseña abre una apelación.' });
}
```

**Impacto cliente:** el botón "borrar" debe ocultarse para no-admins en
móvil/admin. En su lugar, ofrecer "Apelar reseña" (ver Bloque 5).

---

# Bloque 3 — Seguridad

## 3.1 🔴 Mover Google Maps API key al backend (proxy)

**Archivos involucrados:**
- `saferide-frontend/app.json` (cliente — eliminar key)
- `saferide-frontend/src/screens/pasajero/TripInProgress.js:19` (eliminar key)
- `saferide-frontend/src/screens/conductor/CurrentTrip.js:10` (eliminar key)
- `saferide-backend` (crear endpoints proxy)

**Problema:** la key está hardcodeada en cliente. Cualquiera con `apktool`
la extrae. Costo financiero real si se abusa.

**Fix backend (nuevos endpoints proxy):**

```js
// src/routes/mapsRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const mapsController = require('../controllers/mapsController');

router.get('/places/autocomplete', verifyToken, mapsController.placesAutocomplete);
router.get('/places/details/:placeId', verifyToken, mapsController.placeDetails);
router.get('/directions', verifyToken, mapsController.directions);
router.get('/geocode', verifyToken, mapsController.geocode);

module.exports = router;
```

```js
// src/controllers/mapsController.js
const axios = require('axios');
const KEY = process.env.GOOGLE_MAPS_SERVER_KEY; // key restringida por IP

exports.placesAutocomplete = async (req, res) => {
  const { input, sessiontoken, components = 'country:cr' } = req.query;
  const { data } = await axios.get(
    'https://maps.googleapis.com/maps/api/place/autocomplete/json',
    { params: { input, sessiontoken, components, key: KEY } }
  );
  res.json(data);
};
// análogos para los otros endpoints
```

**Para los mapas en-app** (que sí necesitan key cliente para render):
- Generar **una segunda key restringida a Android package + iOS bundle ID**
  (no a HTTP referrer). Aun si se extrae, no funciona fuera de tu app.
- Esa key sí puede vivir en `app.json`, pero documentar la restricción.

**Riesgo:** medio. Latencia añadida al backend, pero protege costo.

---

## 3.2 🟠 Cerrar TODO de Azure Entra ID

**Archivo:** `src/config/auth.js:17`
**Problema:** `passport-azure-ad` está instalado y configurado parcialmente,
pero la validación del token Bearer AAD no está implementada. Superficie de
ataque innecesaria.

**Decisión a tomar:**
- **Opción A:** completar la integración AAD (passport-azure-ad BearerStrategy
  con tenant, clientID, audience). Útil si las empresas ancla quieren SSO.
- **Opción B:** eliminar `passport-azure-ad` del repo. Más simple si no hay
  plan de SSO próximo.

Recomendación: **Opción B ahora**, **Opción A cuando un cliente B2B lo pida**.

---

## 3.3 🟠 Hashear refresh token en BD

**Archivo:** `src/models/User.js`, `src/controllers/authController.js`
**Problema:** `refreshToken` se guarda plano. Filtración de BD = secuestro
masivo de sesiones.

**Fix:**

```js
// authController.js login()
const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Al emitir el refresh:
const refreshToken = jwt.sign(...);
user.refreshToken = hashToken(refreshToken);
await user.save();
res.json({ accessToken, refreshToken });  // se manda en claro UNA vez

// Al validar en POST /auth/refresh:
const hash = hashToken(req.body.refreshToken);
const user = await User.findOne({ refreshToken: hash });
```

**Riesgo:** medio. Requiere invalidar todas las sesiones existentes (force
logout global). Coordinar con equipo móvil para mostrar mensaje suave.

---

## 3.4 🟡 Logout robusto

**Archivo:** `src/controllers/authController.js` (función `logout`)
**Problema:** logout best-effort: si el cliente cae antes de llamar
`DELETE /auth/logout`, el refresh token sigue vivo 7 días.

**Fix complementario:**
- Endpoint `DELETE /auth/logout-all` que invalida todos los refreshTokens del
  user (caso "perdí mi celular").
- En el cliente, si `POST /auth/refresh` retorna 401, el móvil ya borra el
  token local (esto ya funciona) — agregar también que el backend invalide
  cualquier refresh asociado al device.

---

## 3.5 🟡 CORS más restrictivo

**Archivo:** `src/app.js`
**Problema:** `cors()` sin opciones acepta cualquier origen.

**Fix:**

```js
app.use(cors({
  origin: [
    'https://admin.saferide.cr',
    'https://saferide.cr',
    /\.saferide\.cr$/,
    /localhost:\d+$/  // solo en dev
  ],
  credentials: true
}));
```

---

# Bloque 4 — Nuevos modelos SafeScore

> Estos modelos son NUEVOS, no rompen los existentes. Se pueden crear en
> paralelo con el backend actual y migrar lazy.

## 4.1 🟠 Modelo `ReviewV2.js`

**Archivo:** `src/models/ReviewV2.js` (nuevo)

```js
const mongoose = require('mongoose');

const reviewV2Schema = new mongoose.Schema({
  ride_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewer_role: { type: String, enum: ['driver', 'passenger'], required: true },

  ratings: {
    safety:        { type: Number, min: 1, max: 5 },
    punctuality:   { type: Number, min: 1, max: 5 },
    cleanliness:   { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    conduction:    { type: Number, min: 1, max: 5 },  // solo driver→passenger? no, passenger→driver
    manners:       { type: Number, min: 1, max: 5 }   // driver→passenger
  },
  overall: { type: Number, min: 1, max: 5, required: true },

  positive_tags: [{ type: String }],
  negative_tags: [{ type: String }],
  comment: { type: String, maxlength: 500 },

  geo_verified: { type: Boolean, default: false },
  reviewer_location_at_submit: {
    lat: Number, lng: Number
  },

  status: {
    type: String,
    enum: ['pending_blind', 'published', 'suppressed', 'disputed', 'moderation_queue'],
    default: 'pending_blind',
    index: true
  },
  visibility_at: { type: Date, index: true },

  moderation: {
    toxicity_score: Number,
    nlp_flags: [String],
    moderator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decision: { type: String, enum: ['approved', 'rejected', 'edited'] },
    decided_at: Date
  },

  anomaly_flags: [String],
  weight: { type: Number, default: 1.0, min: 0, max: 1 },

  appealed: {
    is_appealed: { type: Boolean, default: false },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, enum: ['not_applicable', 'false', 'offensive', 'retaliation'] },
    description: String,
    resolution: { type: String, enum: ['upheld', 'removed', 'edited'] },
    resolved_at: Date,
    resolver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { timestamps: true });

// Índices
reviewV2Schema.index({ ride_id: 1, reviewer_id: 1, reviewee_id: 1 }, { unique: true });
reviewV2Schema.index({ reviewee_id: 1, status: 1, visibility_at: -1 });
reviewV2Schema.index({ reviewer_id: 1, createdAt: -1 });   // velocity check
reviewV2Schema.index({ status: 1, visibility_at: 1 });     // visibility job

module.exports = mongoose.model('ReviewV2', reviewV2Schema, 'reviews_v2');
```

## 4.2 🟠 Modelo `Complaint.js`

**Archivo:** `src/models/Complaint.js` (nuevo) — reemplaza `complaints.json`
del admin.

```js
const complaintSchema = new mongoose.Schema({
  reporter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reported_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  ride_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
  category: {
    type: String,
    enum: ['safety', 'harassment', 'fraud', 'documents', 'payment', 'other'],
    required: true
  },
  subject: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 2000 },
  attachments: [{ type: String }], // URLs Azure Blob
  status: {
    type: String,
    enum: ['open', 'investigating', 'resolved', 'dismissed'],
    default: 'open',
    index: true
  },
  resolution: String,
  resolver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolved_at: Date,
  email_thread_id: String   // si vino por email
}, { timestamps: true });

complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ reported_id: 1, status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
```

## 4.3 🟡 Modelo `TagCatalog.js`

```js
const tagSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // 'clean', 'late', 'rude'
  label_es: String,
  label_en: String,
  emoji: String,
  category: { type: String, enum: ['positive', 'negative'], required: true },
  role: { type: String, enum: ['driver', 'passenger', 'both'], required: true },
  dimension: { type: String, enum: ['safety','punctuality','cleanliness','communication','conduction','manners'] },
  active: { type: Boolean, default: true },
  display_order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('TagCatalog', tagSchema);
```

**Seed inicial:** ver `src/scripts/seed_tag_catalog.js` (a crear).

## 4.4 🟡 Modelo `ReputationEvent.js`

```js
const eventSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  source: { type: String, enum: ['review', 'cancellation', 'document', 'admin', 'incident', 'recompute'], required: true },
  delta_dimension: String,     // 'safety', 'overall', etc.
  delta_value: Number,         // +0.02, -0.15
  previous_value: Number,
  new_value: Number,
  source_ref: { type: mongoose.Schema.Types.ObjectId },
  source_model: String,        // 'ReviewV2', 'Booking', 'Complaint'
  notes: String
}, { timestamps: { createdAt: true, updatedAt: false } });

eventSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('ReputationEvent', eventSchema);
```

## 4.5 🟠 Extender `User.js` con `reputationSnapshot`

```js
// Añadir al schema User
reputationSnapshot: {
  overall: {
    value: { type: Number, default: null },
    samples: { type: Number, default: 0 },
    lastUpdate: Date
  },
  dimensions: {
    safety:        { value: Number, samples: Number },
    punctuality:   { value: Number, samples: Number },
    cleanliness:   { value: Number, samples: Number },
    communication: { value: Number, samples: Number },
    conduction:    { value: Number, samples: Number },
    manners:       { value: Number, samples: Number }
  },
  cancellation_rate: { type: Number, default: 0 },
  punctuality_objective: Number,
  badges: [{
    code: String,
    awardedAt: Date
  }],
  level: { type: String, enum: ['rookie', 'driver', 'pro', 'champion'], default: 'rookie' },
  risk_score: { type: Number, default: 0, min: 0, max: 100 },
  reviewer_credibility: { type: Number, default: 0.5, min: 0, max: 1 },
  company_scope: { type: Map, of: {
    overall: Number,
    samples: Number
  }}
}
```

Índices:
```js
userSchema.index({ 'reputationSnapshot.level': 1, company: 1 });
userSchema.index({ 'reputationSnapshot.risk_score': -1 }, { partialFilterExpression: { 'reputationSnapshot.risk_score': { $gte: 50 } } });
```

---

# Bloque 5 — Nuevos endpoints SafeScore

> Todos los endpoints deben usar `verifyToken` + `requireActive` salvo los
> de admin que también requieren `authorize('admin')`.

## 5.1 🟠 Endpoints de reseñas v2

```
POST   /api/v1/reviews/v2                    # Crear (entra a doble ciego)
GET    /api/v1/reviews/v2/pending-mine       # Mis reseñas pendientes por escribir
GET    /api/v1/reviews/v2/received/:userId   # Reseñas published recibidas
GET    /api/v1/reviews/v2/written/me         # Mis reseñas escritas
GET    /api/v1/reviews/v2/user/:id/snapshot  # reputationSnapshot completo
POST   /api/v1/reviews/v2/:id/appeal         # Apelar
```

**Body de `POST /reviews/v2`:**

```json
{
  "ride_id": "...",
  "reviewee_id": "...",
  "ratings": { "safety": 5, "punctuality": 4, ... },
  "overall": 5,
  "positive_tags": ["clean", "smooth_driving"],
  "negative_tags": [],
  "comment": null,
  "location": { "lat": 9.93, "lng": -84.08 }
}
```

**Lógica del controller:**

```js
async function createReviewV2(req, res) {
  // 1. Validar que el ride está completed
  // 2. Validar participación (reviewer es driver o passenger del ride)
  // 3. Validar reviewee correcto (counter-parte)
  // 4. Validar no duplicado (índice ya lo hace, manejar 11000)
  // 5. Geo verify
  const geoVerified = await geoVerificationService.verifyReviewLocation(
    req.user._id, ride_id, location
  );
  // 6. Crear con status=pending_blind, visibility_at=now+24h
  const review = await ReviewV2.create({
    ...body,
    reviewer_id: req.user._id,
    reviewer_role: req.user._id.equals(ride.driver_id) ? 'driver' : 'passenger',
    geo_verified: geoVerified,
    status: 'pending_blind',
    visibility_at: new Date(Date.now() + 24 * 3600 * 1000)
  });
  // 7. Si hay comentario, encolar moderación
  if (body.comment) {
    await moderationQueue.add({ reviewId: review._id });
  }
  // 8. Si la counter-parte ya escribió, publicar ambas
  const counterReview = await ReviewV2.findOne({
    ride_id, reviewer_id: reviewee_id, reviewee_id: req.user._id,
    status: 'pending_blind'
  });
  if (counterReview) {
    await ReviewV2.updateMany(
      { _id: { $in: [review._id, counterReview._id] } },
      { $set: { status: 'published' } }
    );
    await reputationQueue.add({ userIds: [req.user._id, reviewee_id] });
  }
  // 9. Anti-retaliation check (Bloque 7)
  await antiFraudService.retaliationCheck(req.user._id, reviewee_id, ride_id);

  res.status(201).json({ message: 'Reseña enviada. Se publicará cuando ambos completen.' });
}
```

## 5.2 🟠 Endpoints de complaints

```
POST   /api/v1/complaints
GET    /api/v1/complaints/mine
GET    /api/v1/complaints (admin)
GET    /api/v1/complaints/:id (admin o reporter)
PATCH  /api/v1/complaints/:id/status (admin)
POST   /api/v1/complaints/:id/notes (admin)
```

## 5.3 🟡 Endpoints de reputación / leaderboard / badges

```
GET    /api/v1/reputation/leaderboard?scope=company&company=Intel
GET    /api/v1/reputation/badges/me
GET    /api/v1/reputation/badges/catalog
```

## 5.4 🟠 Endpoints admin de moderación

```
GET    /api/v1/admin/reviews/moderation-queue
PATCH  /api/v1/admin/reviews/:id/decision   # approve/reject/edit
GET    /api/v1/admin/appeals
PATCH  /api/v1/admin/appeals/:id/resolve
GET    /api/v1/admin/reputation/risk-feed   # users con risk_score > 70
POST   /api/v1/admin/reputation/recompute/:userId
POST   /api/v1/admin/reputation/reset/:userId
GET    /api/v1/admin/tag-catalog
POST   /api/v1/admin/tag-catalog
PATCH  /api/v1/admin/tag-catalog/:code
```

---

# Bloque 6 — Workers y cron jobs

## 6.1 🟠 Activar Bull + Redis

**Archivo:** `src/config/queue.js` (nuevo)

```js
const Queue = require('bull');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const reputationQueue = new Queue('reputation:recompute', REDIS_URL);
const moderationQueue = new Queue('moderation:review', REDIS_URL);
const pushQueue       = new Queue('push:send', REDIS_URL);

module.exports = { reputationQueue, moderationQueue, pushQueue };
```

**Inicializar workers** en `src/workers/index.js`:

```js
require('./reputationWorker');
require('./moderationWorker');
require('./notificationWorker');
```

Llamar desde `server.js`: `require('./src/workers');` solo si `process.env.RUN_WORKERS === 'true'` (para poder correr web y worker en dynos separados).

## 6.2 🟠 `reputationWorker.js`

```js
const { reputationQueue } = require('../config/queue');
const { recomputeUserSnapshot } = require('../services/reputationService');

reputationQueue.process(5, async (job) => {
  const { userIds } = job.data;
  for (const uid of userIds) {
    await recomputeUserSnapshot(uid);
  }
});
```

## 6.3 🟠 `moderationWorker.js`

```js
const { moderationQueue } = require('../config/queue');
const { scoreText, decideAutoOrQueue } = require('../services/moderationService');
const ReviewV2 = require('../models/ReviewV2');

moderationQueue.process(2, async (job) => {
  const review = await ReviewV2.findById(job.data.reviewId);
  if (!review || !review.comment) return;
  const score = await scoreText(review.comment, 'es');
  const decision = decideAutoOrQueue(score);
  review.moderation = { toxicity_score: score.toxicity, nlp_flags: score.flags };
  if (decision === 'auto_approve') {
    // queda en pending_blind hasta visibility_at
  } else if (decision === 'auto_reject') {
    review.status = 'suppressed';
  } else {
    review.status = 'moderation_queue';
  }
  await review.save();
});
```

## 6.4 🟠 Nuevos cron jobs en `scheduledJobs.js`

```js
// Cada hora: publicar reviews cuya ventana doble ciego expiró
cron.schedule('0 * * * *', async () => {
  const now = new Date();
  await ReviewV2.updateMany(
    { status: 'pending_blind', visibility_at: { $lte: now } },
    { $set: { status: 'published' } }
  );
  // Encolar recompute de afectados
});

// Cada 10 min: drenar cola dirty de reputación
// (alternativa: trigger directo, no necesita cron)

// 3 AM diario: anti-fraude nocturno
cron.schedule('0 3 * * *', () => antiFraudNightlyJob());

// 4 AM diario: evaluación de badges
cron.schedule('0 4 * * *', () => badgeEvaluationJob());

// Cada 4h, 20h, 23h post-ride: recordatorio review (mejor con job individual al completar el ride)
```

---

# Bloque 7 — Integraciones IA

## 7.1 🟠 `moderationService.js`

```js
const axios = require('axios');

// Opción A: OpenAI moderation (gratuito al momento de escribir)
async function scoreTextOpenAI(text) {
  const { data } = await axios.post(
    'https://api.openai.com/v1/moderations',
    { input: text, model: 'omni-moderation-latest' },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
  );
  const r = data.results[0];
  return {
    toxicity: Math.max(...Object.values(r.category_scores)),
    flags: Object.entries(r.categories).filter(([_, v]) => v).map(([k]) => k)
  };
}

// Opción B: Perspective API (Google) — mejor para español
async function scoreTextPerspective(text) {
  const { data } = await axios.post(
    `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${process.env.PERSPECTIVE_API_KEY}`,
    {
      comment: { text },
      languages: ['es'],
      requestedAttributes: { TOXICITY: {}, SEVERE_TOXICITY: {}, INSULT: {}, THREAT: {} }
    }
  );
  return {
    toxicity: data.attributeScores.TOXICITY.summaryScore.value,
    flags: Object.entries(data.attributeScores)
      .filter(([_, v]) => v.summaryScore.value > 0.6)
      .map(([k]) => k.toLowerCase())
  };
}

function localBlacklistCheck(text) {
  const blacklist = ['palabra1', 'palabra2']; // mantener en collection editable
  const lower = text.toLowerCase();
  return blacklist.some(w => lower.includes(w));
}

function decideAutoOrQueue({ toxicity }) {
  if (toxicity > 0.85) return 'auto_reject';
  if (toxicity < 0.30) return 'auto_approve';
  return 'queue';
}

module.exports = { scoreText: scoreTextPerspective, localBlacklistCheck, decideAutoOrQueue };
```

## 7.2 🟠 `antiFraudService.js`

```js
async function velocityCheck(reviewerId) {
  const lastHour = new Date(Date.now() - 3600_000);
  const count = await ReviewV2.countDocuments({ reviewer_id: reviewerId, createdAt: { $gte: lastHour } });
  return count > 5; // true = sospechoso
}

async function retaliationCheck(reviewerId, revieweeId, rideId) {
  const counter = await ReviewV2.findOne({
    ride_id: rideId,
    reviewer_id: revieweeId,
    reviewee_id: reviewerId
  });
  if (!counter) return false;
  // Si ambos ≤ 2 estrellas overall y dentro de ventana doble ciego
  const myReview = await ReviewV2.findOne({ ride_id: rideId, reviewer_id: reviewerId, reviewee_id: revieweeId });
  if (myReview.overall <= 2 && counter.overall <= 2 && counter.status === 'pending_blind') {
    // Suprimir ambas, abrir caso admin
    await ReviewV2.updateMany(
      { _id: { $in: [myReview._id, counter._id] } },
      { $set: { status: 'disputed', anomaly_flags: ['retaliation_detected'] } }
    );
    // Notificar admin (ver complaintService)
    return true;
  }
  return false;
}

// Job nocturno
async function networkAnalysis() {
  // Detectar clusters A↔B↔C↔A con ratings 5★ mutuos
  // Algoritmo: Louvain o simple grafo
  // Implementación con `graphology` + `graphology-communities-louvain`
}

module.exports = { velocityCheck, retaliationCheck, networkAnalysis };
```

## 7.3 🟡 `geoVerificationService.js`

```js
const Ride = require('../models/Ride');

const EARTH_RADIUS_M = 6_371_000;

function haversine(a, b) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const x = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(x));
}

async function verifyReviewLocation(userId, rideId, location) {
  if (!location || !location.lat || !location.lng) return false;
  const ride = await Ride.findById(rideId).select('destination origin');
  if (!ride) return false;
  const dest = ride.destination.coordinates;
  const dist = haversine(location, dest);
  return dist <= 500; // dentro de 500m del destino
}

module.exports = { verifyReviewLocation };
```

---

# Bloque 8 — Escalabilidad

## 8.1 🟡 Índice 2dsphere real en `Ride`

```js
// En src/models/Ride.js
rideSchema.index({ 'origin.coordinates': '2dsphere' });
rideSchema.index({ 'destination.coordinates': '2dsphere' });
```

⚠️ Cosmos Mongo API tiene limitaciones — verificar que `2dsphere` esté soportado en el tier vCore (sí lo está en vCore; no lo está en RU-based). Ajustar query del searchRides para usar `$near`.

## 8.2 🟡 Caché Redis para snapshots

```js
// reputationService
async function getCachedSnapshot(userId) {
  const cached = await redis.get(`reputation:${userId}`);
  if (cached) return JSON.parse(cached);
  const user = await User.findById(userId).select('reputationSnapshot');
  await redis.setex(`reputation:${userId}`, 300, JSON.stringify(user.reputationSnapshot));
  return user.reputationSnapshot;
}
```

Invalidar en cada `recomputeUserSnapshot`.

## 8.3 🟢 Reemplazar polling `usePaidNotices` por Socket.io

`socket.io` no está aún. Se añade en una fase posterior. Por ahora el polling
cada 25s vive bien hasta ~500 usuarios concurrentes.

---

# Bloque 9 — Tests

## 9.1 🔴 Mínimo: cobertura > 50% en módulo de reseñas

Tests obligatorios antes de deploy de SafeScore:

- `tests/reputationService.test.js`
  - `bayesianAverage` con 0, 1, 100 muestras
  - `applyDecay` con muestras de distintos días
  - Edge cases: prior cuando no hay reviews
- `tests/reviewV2.integration.test.js`
  - Doble ciego: enviar un lado → no publicado; enviar ambos → publicado
  - Visibility job: publica los que expiraron
  - Anti-retaliación: dos 1★ entre los mismos → ambos disputed
  - Velocity: enviar 6 reviews en 1h → flag
- `tests/moderationService.test.js`
  - Texto limpio → auto_approve
  - Texto ofensivo → auto_reject
  - Texto gris → queue
- `tests/geoVerification.test.js`
  - 200m del destino → verified
  - 5km → no verified

## 9.2 🟢 CI

GitHub Actions o Azure Pipelines: `npm test` en PR + bloquear merge si cobertura < threshold.

---

# Orden recomendado de aplicación

Una vez liberada la rama de backend, el orden óptimo (semanas):

| Semana | Items |
|--------|-------|
| 1 | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2, 3.5 |
| 2 | 2.1 (Bayesian + recompute script), 2.3, 3.3 (hash refresh), 3.4 |
| 3 | 4.1 (ReviewV2), 4.5 (reputationSnapshot), 6.1 (Bull/Redis) |
| 4 | 5.1 (endpoints reviews v2), 6.2 (reputationWorker), 6.4 (visibility cron) |
| 5 | 4.2 (Complaint), 4.3 (TagCatalog), 5.2 (endpoints complaints), 5.3 |
| 6 | 7.1 (moderationService), 6.3 (moderationWorker) |
| 7 | 7.2 (antiFraudService), 7.3 (geoVerification) |
| 8 | 4.4 (ReputationEvent), 5.4 (endpoints admin) |
| 9 | 8.1, 8.2 (índices, cache) |
| 10 | 3.1 (Maps proxy), 3.2 (decisión AAD) |
| 11–12 | 9.1, 9.2 (tests + CI), hardening |

---

# Notas para el equipo

- **Comunicar a usuarios antes del item 2.1**: algunos ratings bajarán visualmente al recalcular con Bayesian + decay. Esto es correcto técnicamente pero requiere mensaje de producto.
- **El item 3.3 (hash refresh) invalida sesiones** — coordinar con móvil para mostrar pantalla suave de re-login.
- **El item 1.1 (collapse cancelled/canceled) requiere migration job** corrido antes del deploy.
- **Todo lo nuevo (Bloques 4–7) puede crearse en paralelo** sin interferir con el backend actual: modelos nuevos en colecciones nuevas, endpoints en rutas nuevas (`/api/v1/reviews/v2/*`), workers en procesos separados.

---

_Última actualización: 2026-05-25 — generado durante el análisis SafeScore._
