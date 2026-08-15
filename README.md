# NannyPro API

Production-ready REST API for the NannyPro Nanny & Childcare Candidate Application.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js 5 |
| Database | MongoDB + Mongoose 9 |
| Auth | JWT (admin only) + bcryptjs |
| File uploads | Multer (memory) → Cloudinary (authenticated delivery) |
| Security | Helmet, CORS, express-rate-limit |

---

## Project Structure

```
api/
├── app.js                    ← Entry point (DB connect → start server)
├── src/
│   ├── config/
│   │   ├── db.js             ← Mongoose connection
│   │   ├── cloudinary.js     ← Cloudinary SDK config
│   │   └── env.js            ← Validated environment variables
│   │
│   ├── models/
│   │   ├── Application.js    ← Full candidate application schema
│   │   └── Admin.js          ← Admin account schema
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js  ← JWT protect + requireRole
│   │   ├── uploadMiddleware.js← Multer memory storage + file validation
│   │   ├── errorMiddleware.js ← Centralised error handler + 404
│   │   └── validateRequest.js ← Sanitise, strip, validate body
│   │
│   ├── services/
│   │   ├── cloudinaryService.js ← Upload, delete, signed URL generation
│   │   └── applicationService.js← Form → schema mapping, file processing
│   │
│   ├── controllers/
│   │   ├── applicationController.js
│   │   ├── documentController.js
│   │   └── adminController.js
│   │
│   ├── routes/
│   │   ├── applicationRoutes.js
│   │   ├── documentRoutes.js
│   │   └── adminRoutes.js
│   │
│   ├── utils/
│   │   ├── generateReference.js ← NAN-YYYY-XXXXX generator
│   │   ├── apiResponse.js       ← successResponse / errorResponse helpers
│   │   └── seedAdmin.js         ← Admin seed script
│   │
│   └── server.js             ← Express app (middleware + routes)
│
├── .env                      ← Your real credentials (never commit)
├── .env.example              ← Template (safe to commit)
└── package.json
```

---

## Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- A MongoDB Atlas cluster (or local MongoDB)
- A Cloudinary account

### 2. Install dependencies

```bash
cd api
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5000) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Strong random secret for JWT signing |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `1d`, `7d`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLIENT_URL` | React frontend URL (for CORS) |
| `ADMIN_EMAIL` | Email for the first admin account |
| `ADMIN_PASSWORD` | Password for the first admin account |

### 4. Seed the admin account

```bash
npm run seed:admin
```

This creates (or updates) an admin account using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. The password is bcrypt-hashed before storage.

### 5. Run locally

```bash
npm run dev    # nodemon — auto-restarts on changes
npm start      # node — production
```

The server starts at `http://localhost:5000`.

Health check: `GET http://localhost:5000/api/v1/health`

---

## API Reference

### Base URL
```
/api/v1
```

### Authentication

Admin endpoints require a `Bearer` token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

Obtain a token via `POST /admin/login`.

---

### Public Endpoints

#### `POST /applications`
Submit a new candidate application.

- **Content-Type:** `multipart/form-data`
- **Rate limit:** 5 requests per IP per hour
- **Auth:** None

**Form fields** (key → value):
- All text/select fields sent as flat key-value strings
- `references` — JSON-stringified array
- `ageGroups` — JSON-stringified array
- File fields: `docId`, `docDBS`, `docPFA`, `docQual`, `docRTW`, `docOther`, `dbsCertFiles`, `rtwFiles`

**Success response:**
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "applicationReference": "NAN-2026-A3F8K"
  }
}
```

---

#### `POST /admin/login`
Authenticate as an admin.

- **Rate limit:** 10 attempts per IP per 15 minutes

```json
// Request
{ "email": "admin@nannypro.co.uk", "password": "YourPassword" }

// Response
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJ...",
    "admin": { "id": "...", "email": "...", "role": "admin" }
  }
}
```

---

### Admin Endpoints (JWT required)

#### `GET /admin/me`
Get the authenticated admin's profile.

---

#### `GET /applications`
List all applications with pagination and filtering.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20, max: 100) |
| `status` | string | Filter by status |
| `search` | string | Search name, email, reference, city |
| `sortBy` | string | Field to sort by (default: `createdAt`) |
| `sortOrder` | `asc`\|`desc` | Sort direction (default: `desc`) |
| `workType` | string | Filter by work type |
| `liveInOut` | string | Filter by live-in/out preference |

**Response:**
```json
{
  "success": true,
  "data": [ ...applications ],
  "pagination": {
    "page": 1, "limit": 20, "total": 47,
    "totalPages": 3, "hasNextPage": true, "hasPrevPage": false
  }
}
```

---

#### `GET /applications/:id`
Get a single application by MongoDB `_id`.

---

#### `PATCH /applications/:id/status`
Update application status.

```json
// Request
{ "status": "Interview" }
```

Valid statuses: `New`, `Under Review`, `Documents Pending`, `References`, `Interview`, `Vetting`, `Approved`, `Not Approved`

---

#### `POST /applications/:id/notes`
Add an internal note (never visible to candidates).

```json
// Request
{ "text": "Candidate called to arrange interview" }
```

---

#### `GET /applications/:id/notes`
Get all internal notes for an application.

---

#### `POST /applications/:id/documents`
Upload additional documents to an existing application.

- **Content-Type:** `multipart/form-data`
- File fields: `docId`, `docDBS`, `docPFA`, `docQual`, `docRTW`, `docOther`

---

#### `GET /applications/:id/documents`
Get document metadata with **signed, time-limited download URLs** (1-hour expiry).

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "type": "DBS",
      "originalName": "dbs-certificate.pdf",
      "resourceType": "raw",
      "signedUrl": "https://res.cloudinary.com/...?signature=...&expires_at=..."
    }
  ]
}
```

---

#### `DELETE /applications/:id/documents/:documentId`
Delete a document. Removes from Cloudinary first, then from MongoDB. If Cloudinary deletion fails, the MongoDB record is preserved (safe retry).

---

## File Upload Flow

```
React (FormData)
  ↓ multipart/form-data POST
Express + Multer (memory storage — no disk writes)
  ↓ file buffers in req.files
cloudinaryService.uploadFile()
  ↓ streams buffer via upload_stream
Cloudinary (authenticated delivery — not publicly accessible)
  ↓ publicId, resourceType, format, bytes
MongoDB (document metadata only — no binary data)
  ↓
Admin GET /documents → generateSignedUrl() → 1-hour signed download URL
```

**Security:** All files are stored in Cloudinary with `type: "authenticated"`. Raw `publicId` values are never returned to the frontend. Admin document access goes through `generateSignedUrl()` which produces cryptographically-signed, time-limited URLs.

---

## Document Types

| Multer field | Document type |
|---|---|
| `docId` | `ID` |
| `docDBS`, `dbsCertFiles` | `DBS` |
| `docPFA` | `PAEDIATRIC_FIRST_AID` |
| `docQual` | `CHILDCARE_QUALIFICATION` |
| `docRTW`, `rtwFiles` | `RIGHT_TO_WORK` |
| `docOther` | `OTHER` |

---

## Application Statuses

`New` → `Under Review` → `Documents Pending` → `References` → `Interview` → `Vetting` → `Approved` / `Not Approved`

Only authenticated admins can change status. The backend always sets `New` on initial submission regardless of any frontend-supplied value.

---

## Security Notes

- **No candidate authentication** — applications are submitted anonymously
- **Rate limiting** — 5 submissions/hour per IP on POST `/applications`; 10 login attempts/15min on admin login
- **Input validation** — server-side validation runs independently of React Hook Form
- **Field stripping** — `status`, `applicationReference`, `_id`, `notes`, `documents` are stripped from public submissions
- **Cloudinary authenticated delivery** — documents are never publicly accessible
- **DBS certificate numbers** — excluded from all list endpoints; only visible in full single-application detail
- **Stack traces** — suppressed in `NODE_ENV=production`
- **CORS** — only allows `CLIENT_URL` origin in production

---

## Testing Endpoints

Use the following sequence to test all endpoints:

```bash
# 1. Login
curl -X POST http://localhost:5000/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nannypro.co.uk","password":"ChangeMe123!"}'

# Store the token
TOKEN="eyJ..."

# 2. Check profile
curl http://localhost:5000/api/v1/admin/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Submit a test application (minimal)
curl -X POST http://localhost:5000/api/v1/applications \
  -F "fullName=Jane Smith" \
  -F "email=jane@example.com" \
  -F "phone=07700900000" \
  -F "address=123 Test Street" \
  -F "city=London" \
  -F "postcode=SW1A 1AA" \
  -F "nationality=British" \
  -F "languages=English" \
  -F 'references=[{"employerName":"Test Family","email":"family@test.com","phone":"07700900001","role":"Nanny","relationship":"Employer","startDate":"2023-01-01"}]' \
  -F "declarationAccurate=true" \
  -F "agreePrivacy=true" \
  -F "agreeTerms=true" \
  -F "declarationName=Jane Smith"

# 4. List applications
curl "http://localhost:5000/api/v1/applications?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# 5. Update status (replace :id with a real _id from step 4)
curl -X PATCH http://localhost:5000/api/v1/applications/:id/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Under Review"}'

# 6. Add a note
curl -X POST http://localhost:5000/api/v1/applications/:id/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Candidate contacted for interview"}'

# 7. Get documents (signed URLs)
curl http://localhost:5000/api/v1/applications/:id/documents \
  -H "Authorization: Bearer $TOKEN"
```

---

## Frontend Integration

The React frontend (`client/`) connects via `client/src/api/applications.js`.

Set the API URL in `client/.env.local`:
```
VITE_API_URL=http://localhost:5000/api/v1
```

For production, update to your deployed API URL.

---

## Production Deployment

1. Set `NODE_ENV=production` in your hosting environment
2. Use a strong `JWT_SECRET` (minimum 64 random bytes)
3. Set `CLIENT_URL` to your production frontend domain
4. Ensure `MONGODB_URI` points to a production Atlas cluster
5. Run `npm run seed:admin` once after first deployment
6. Use a process manager (PM2, Railway, Render, etc.)
