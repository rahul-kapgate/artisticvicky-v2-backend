# AV Art Academy — Backend

> Backend API for a production EdTech platform supporting courses, users, enrollments, resources, videos, mock tests, PYQs, payments, file storage, email, and administrative workflows.

This repository contains the backend for **AV Art Academy / Artistic Vicky**, an EdTech platform focused on MAH AAC CET preparation and structured online learning.

The backend is built with **Node.js and Express 5** and provides the application layer for authentication, course management, student access, enrollments, payments, resources, video content, mock tests, file handling, email workflows, and administrative features.

**Live Website:** https://artisticvickey.in/  
**Backend Repository:** https://github.com/rahul-kapgate/artisticvicky-v2-backend  
**Frontend Repository:** https://github.com/rahul-kapgate/artisticvicky-v2-frontend

---

# Overview

AV Art Academy combines the core systems required by a modern learning platform:

```text
Users
Courses
Enrollments
Resources
Videos
Mock Tests
PYQs
Payments
Storage
Email
Invoices
Admin Workflows
```

The backend exposes APIs consumed by the separate React frontend and keeps sensitive operations such as authentication, payment verification, file access, database access, and business rules on the server.

---

# Features

## Authentication & Users

The backend supports account and authentication workflows such as:

- User registration
- Password hashing
- Email/OTP verification flows
- Login
- JWT-based authentication
- Authenticated user access
- Role-aware application workflows
- Google authentication support
- Profile-related backend operations

Security-related dependencies include:

- `bcrypt`
- `jsonwebtoken`
- `google-auth-library`
- `cookie-parser`
- `helmet`
- `cors`

---

## Course Management

The backend supports course-oriented business logic such as:

- Creating courses
- Updating course information
- Course details
- Draft/public visibility workflows
- Free and paid course configurations
- Pricing
- Access type configuration
- Course resource relationships
- Course video relationships

Typical flow:

```text
Admin
  │
  ▼
Create Course
  │
  ├── Basic Details
  ├── Pricing
  ├── Visibility
  ├── Thumbnail/Banner
  └── Access Configuration
        │
        ▼
      Database
        │
        ▼
Frontend Course Listing
```

---

## Enrollments

Enrollment logic connects:

- Users
- Courses
- Payment state
- Access state
- Course learning content

Typical paid enrollment flow:

```text
Student
   │
   ▼
Select Paid Course
   │
   ▼
Create Payment Order
   │
   ▼
Razorpay
   │
   ▼
Payment Verification
   │
   ▼
Enrollment Record
   │
   ▼
Course Access
```

---

## Payments

The current backend includes Razorpay support for paid learning flows.

The server is responsible for sensitive payment operations rather than trusting payment state from the browser.

Backend responsibilities can include:

- Creating payment orders
- Verifying payment details
- Linking payments to enrollments
- Persisting transaction state
- Activating course access after successful verification

Dependency:

```text
razorpay
```

---

## Resources & File Management

The platform supports learning resources such as:

- Notes
- PDFs
- eBooks
- Course files
- Images
- Downloadable learning content

The backend contains tooling for cloud/file operations, including:

- AWS S3 SDK
- Backblaze B2 client
- Multer upload handling

Relevant dependencies:

```text
@aws-sdk/client-s3
backblaze-b2
multer
```

---

## Videos

The backend provides the server-side layer required for course video management.

Typical responsibilities:

- Store video metadata
- Associate videos with courses
- Control authenticated access
- Provide ordered course content
- Support admin video management

---

## Mock Tests

The wider platform includes mock-test flows used by students for entrance-exam preparation.

The backend is responsible for persistent exam-related data such as:

- Test definitions
- Questions
- Attempts
- Student answers
- Submission state
- Results
- Review data

The frontend handles the interactive timer and exam UI while the backend remains the source of truth for persistent attempt data.

---

## Previous Year Questions

PYQ workflows allow students to practice historic exam questions and retain their attempt information.

The backend can coordinate:

```text
PYQ Paper
   │
   ├── Questions
   ├── Attempt
   ├── Answers
   └── Result / Review
```

---

## Email

The backend uses **Resend** for application email flows.

Typical uses include:

- OTP verification
- Account emails
- Enrollment communication
- Notifications
- Transaction-related messages

Dependency:

```text
resend
```

---

## PDF & Invoice Generation

The current backend includes PDF generation support through `pdfkit`.

This can support server-generated documents such as:

- Invoices
- Receipts
- Enrollment documents
- Reports

The project also includes `xlsx` for spreadsheet-oriented export/report workflows.

---

## Admin Workflows

The platform includes backend support for administration areas such as:

- Dashboard
- Courses
- Users
- Enrollments
- Reports
- Resources
- Videos
- Artwork
- Invoices
- Notifications

These endpoints allow the frontend admin application to manage platform content without exposing direct database access.

---

# Tech Stack

## Runtime & API

| Technology | Purpose |
| --- | --- |
| Node.js | JavaScript runtime |
| Express 5 | REST API framework |
| JavaScript ES Modules | Backend module system |

## Database & Data

| Technology | Purpose |
| --- | --- |
| Supabase JS | Supabase/PostgreSQL integration |
| Mongoose | MongoDB object modeling where required |
| Axios | External HTTP requests |

## Authentication & Security

| Technology | Purpose |
| --- | --- |
| bcrypt | Password hashing |
| jsonwebtoken | JWT authentication |
| google-auth-library | Google authentication |
| helmet | Security headers |
| cors | Cross-origin rules |
| cookie-parser | Cookie handling |

## Storage & Uploads

| Technology | Purpose |
| --- | --- |
| AWS SDK S3 | Object storage integration |
| Backblaze B2 | Object storage integration |
| Multer | Multipart/file upload handling |

## Payments & Communication

| Technology | Purpose |
| --- | --- |
| Razorpay | Payment processing |
| Resend | Transactional email |

## Documents & Reports

| Technology | Purpose |
| --- | --- |
| PDFKit | PDF generation |
| xlsx | Spreadsheet generation/processing |

## Server Utilities

| Technology | Purpose |
| --- | --- |
| compression | HTTP response compression |
| morgan | HTTP request logging |
| dotenv | Environment configuration |
| nodemon | Development auto-reload |
| cross-env | Cross-platform environment scripts |

---

# Architecture

```text
┌──────────────────────────────────────────┐
│        React / Vite Frontend             │
│        artisticvickey.in                 │
└─────────────────────┬────────────────────┘
                      │
                      │ HTTPS / JSON
                      ▼
┌──────────────────────────────────────────┐
│           Express 5 API Server           │
│                                          │
│ Authentication                           │
│ Users                                    │
│ Courses                                  │
│ Enrollments                              │
│ Resources                                │
│ Videos                                   │
│ Mock Tests                               │
│ PYQs                                     │
│ Payments                                 │
│ Admin                                    │
└──────┬────────────┬──────────┬───────────┘
       │            │          │
       ▼            ▼          ▼
┌────────────┐ ┌──────────┐ ┌─────────────┐
│ Database   │ │ Storage  │ │ Integrations│
│            │ │          │ │             │
│ Supabase   │ │ AWS S3   │ │ Razorpay    │
│ PostgreSQL │ │ B2       │ │ Resend      │
│ / MongoDB  │ │          │ │ Google Auth │
└────────────┘ └──────────┘ └─────────────┘
```

---

# Request Lifecycle

A typical authenticated request follows this flow:

```text
Frontend Request
      │
      ▼
Express Route
      │
      ▼
Authentication
      │
      ▼
Validation
      │
      ▼
Controller / Service Logic
      │
      ▼
Database / Storage / Integration
      │
      ▼
JSON Response
      │
      ▼
Frontend
```

Keeping authentication and business rules on the server prevents paid content and administrative operations from relying on client-side checks alone.

---

# Project Structure

A high-level backend layout generally follows this style:

```text
artisticvicky-v2-backend/
│
├── src/
│   ├── config/              # Application/database configuration
│   ├── controllers/         # HTTP request handlers
│   ├── middleware/          # Auth, errors, uploads, etc.
│   ├── routes/              # Express routes
│   ├── services/            # Business/integration logic
│   ├── utils/               # Shared helpers
│   ├── validators/          # Request validation
│   └── index.js             # Server entry point
│
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

> The exact module names and directory layout can evolve as the backend grows.

---

# Core Domain Model

Conceptually, the platform revolves around the following relationships:

```text
User
 │
 ├──────────────┐
 │              │
 ▼              ▼
Enrollment    Attempt
 │              │
 ▼              ▼
Course       Mock Test / PYQ
 │
 ├── Resources
 ├── Videos
 └── Learning Content

Enrollment
 │
 ▼
Payment

Course / Resource / Video
 │
 ▼
Cloud Storage
```

---

# Authentication Flow

## Registration

```text
User Registration
      │
      ▼
Validate Input
      │
      ▼
Hash Password
      │
      ▼
Send Verification Email / OTP
      │
      ▼
Verify User
      │
      ▼
Account Ready
```

## Login

```text
Email + Password
      │
      ▼
Find User
      │
      ▼
Compare Password
      │
      ▼
Generate JWT
      │
      ▼
Authenticated Session
```

Protected endpoints validate authentication before returning user-specific or administrative data.

---

# Storage Flow

Files should not be stored directly inside the application repository.

Typical upload flow:

```text
Client
  │
  ▼
Multipart Request
  │
  ▼
Multer
  │
  ▼
Backend Validation
  │
  ▼
Cloud Storage
(AWS S3 / B2)
  │
  ▼
Stored File Metadata
  │
  ▼
Database
```

This architecture keeps the API server stateless enough for production scaling.

---

# Payment Flow

```text
Frontend
   │
   ▼
Create Order API
   │
   ▼
Backend
   │
   ▼
Razorpay
   │
   ▼
Payment UI
   │
   ▼
Payment Result
   │
   ▼
Verification API
   │
   ▼
Backend Signature / State Check
   │
   ▼
Enrollment Activated
```

Payment access should only be granted after server-side verification.

---

# Local Development

## Prerequisites

Make sure you have:

- Node.js 18+
- npm
- Git
- Database credentials
- Required cloud/integration credentials for the features you want to run

---

## 1. Clone the Repository

```bash
git clone https://github.com/rahul-kapgate/artisticvicky-v2-backend.git
cd artisticvicky-v2-backend
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create a `.env` file in the project root.

The backend integrates with multiple external systems, so configure only the variables required by the current implementation.

Typical categories include:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
SUPABASE_URL=
SUPABASE_KEY=

# Authentication
JWT_SECRET=

# Email
RESEND_API_KEY=

# Payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Storage
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=

# Frontend / CORS
FRONTEND_URL=http://localhost:5173
```

Depending on the active storage/database modules, additional variables may be required for:

- MongoDB
- Backblaze B2
- Google authentication
- Separate JWT token types
- Production domains

> Use the variable names referenced by the current source code when configuring the environment. Never commit real secrets.

---

## 4. Start Development Server

```bash
npm run dev
```

The development script runs:

```text
cross-env NODE_ENV=development nodemon src/index.js
```

---

## 5. Start Production Mode

```bash
npm start
```

The production start script runs:

```text
node src/index.js
```

---

# Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start development server with nodemon |
| `npm start` | Start Node.js server |

The current repository also contains a placeholder test script. A proper automated test suite is a recommended future improvement.

---

# API Design

The backend is intended to expose REST-style APIs grouped around application domains.

Example route organization:

```text
/api/auth
/api/users
/api/courses
/api/enrollments
/api/resources
/api/videos
/api/mock-tests
/api/pyq
/api/payments
/api/admin
```

Actual endpoints should be treated as defined by the current route implementation and API documentation.

---

# API Documentation

For a production-grade workflow, API documentation should describe:

- Endpoint
- HTTP method
- Authentication requirement
- Role requirement
- Request body
- Query parameters
- Response structure
- Error responses

Example:

```http
POST /api/courses
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "title": "MAH AAC CET Complete Preparation",
  "shortDescription": "Complete entrance exam preparation course.",
  "visibility": "public",
  "isFree": false,
  "priceAmount": 9999,
  "salePriceAmount": 7999,
  "currency": "INR",
  "accessType": "lifetime"
}
```

---

# Security

The backend includes several production-oriented security packages and patterns:

- Password hashing
- JWT authentication
- Helmet security headers
- CORS controls
- Server-side payment verification
- Environment-based secrets
- Protected routes
- Cookie parsing
- Cloud-storage abstraction

Recommended production controls also include:

- HTTPS only
- Secure/HttpOnly/SameSite cookies where cookies are used
- Strict CORS allowlists
- Request validation
- Rate limiting
- Login and OTP attempt throttling
- Short-lived access tokens
- Refresh-token rotation if refresh tokens are used
- File type/size validation
- Signed storage access where required
- Payment webhook verification
- Audit logs for admin actions
- Centralized error handling
- Secret rotation

---

# Logging & Performance

The backend currently includes:

- `morgan` for HTTP logging
- `compression` for HTTP response compression

For larger production deployments, this can evolve toward:

- Structured JSON logging
- Request correlation IDs
- Error monitoring
- Performance metrics
- Health/readiness endpoints
- Centralized log aggregation

---

# Deployment

A typical production architecture can look like:

```text
Internet
   │
   ▼
HTTPS / Reverse Proxy
   │
   ▼
Node.js Express API
   │
   ├── Database
   ├── Object Storage
   ├── Resend
   └── Razorpay
```

Production deployment should configure:

- `NODE_ENV=production`
- Secure environment secrets
- Production CORS origin
- HTTPS
- Database network access
- Storage permissions
- Email sender configuration
- Razorpay production credentials
- Process monitoring/restart strategy

---

# Frontend Integration

Frontend repository:

https://github.com/rahul-kapgate/artisticvicky-v2-frontend

Frontend responsibilities include:

- React UI
- Routing
- Course pages
- Student dashboard
- Mock-test interface
- Resource viewers
- Video experience
- Admin screens
- API requests

Backend responsibilities include:

- Authentication
- Authorization
- Business rules
- Database operations
- Payments
- Storage
- Email
- Server-generated files
- Administrative APIs

---

# Future Improvements

1. Automated API tests with Jest/Supertest
2. Integration tests for payments
3. OpenAPI/Swagger documentation
4. Rate limiting
5. Centralized schema validation
6. Structured logging
7. Error monitoring
8. Health/readiness endpoints
9. Dockerized deployment
10. CI/CD pipeline
11. Database migration workflow
12. Background jobs/queues
13. Redis caching
14. Payment webhook processing
15. Automated email retry handling
16. Role/permission matrix
17. Audit logs
18. File-virus scanning
19. Signed/private content delivery
20. Observability dashboards

---

# Related Repository

### Frontend

https://github.com/rahul-kapgate/artisticvicky-v2-frontend

Built with React, Vite, TypeScript, Tailwind CSS, TanStack Query, Axios, React Router, and modern UI tooling.

---

# Author

**Rahul Kapgate**

GitHub: https://github.com/rahul-kapgate  
Portfolio: https://rahulkapgate.in  
Live Platform: https://artisticvickey.in/

---

If you find the project useful, consider giving the repository a ⭐.
