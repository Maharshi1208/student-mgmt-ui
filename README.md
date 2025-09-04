Student Management System

Full-stack student/course/enrollment management app.

Frontend: React + Vite + Tailwind + shadcn/ui

Backend: Node.js + Express + TypeScript + TypeORM

Database: PostgreSQL (via Docker)

🚀 Features

Manage Students, Courses, Enrollments (CRUD)

Integrity rules:

Block inactive students/courses from enrollments

Confirm before deactivating entities

Cascade updates (email, course code)

Data export:

Timestamped CSV

Printable PDF (via browser print)

Import CSV via Papa Parse

Backend API with Postgres persistence (replaces localStorage)

📂 Project Structure
student-mgmt-ui/      # Frontend (React + Vite)
server/               # Backend (Express + TS + TypeORM)
  src/
    entities/         # DB entities
    controllers/      # Express controllers
    routes/           # Route modules
    middleware/       # Error + notFound handlers
    data-source.ts    # TypeORM config
    index.ts          # Server entrypoint
  docker-compose.yml  # Postgres + pgAdmin
  .env.example        # Backend config sample

🛠️ Backend Setup
1. Clone & install
git clone git@github.com:Maharshi1208/student-mgmt-ui.git
cd student-mgmt-ui/server

# install deps
npm install

2. Configure env

Copy .env.example → .env:

cp .env.example .env


Defaults:

PORT=4000
CORS_ORIGIN=http://localhost:5173
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=student_mgmt
DB_SSL=false

3. Start Postgres
docker-compose up -d


DB: localhost:5432

pgAdmin: http://localhost:5050

login with admin@example.com / admin

4. Run migrations
npm run db:generate -- init
npm run db:migrate

5. Start API
npm run dev


API runs at http://localhost:4000

Health check: http://localhost:4000/api/health
 → { ok: true }

🎨 Frontend Setup
cd student-mgmt-ui
npm install
npm run dev


Default: http://localhost:5173

🔌 API Endpoints

Students

GET /api/students

POST /api/students

PATCH /api/students/:id

DELETE /api/students/:id

Courses

GET /api/courses

POST /api/courses

PATCH /api/courses/:code

DELETE /api/courses/:code

Enrollments

GET /api/enrollments

POST /api/enrollments

DELETE /api/enrollments/:id

Health

GET /api/health

🧪 Testing

Manual testing with Postman / cURL:

curl http://localhost:4000/api/health

📌 Roadmap

 Replace all frontend LocalStorage calls with backend API

 Add filtering/pagination to API

 Add authentication (JWT)

 Deploy backend with Docker
