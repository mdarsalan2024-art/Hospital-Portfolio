# BC Roy Hospital, Kharagpur: website and patient portal

React (Vite) + Node/Express + PostgreSQL. **Seed data is demo data**: sample doctors and medicines, not real availability or stock. Hospital phone/email/address/insurance are placeholders to fill in.

## Features
Home with search and emergency info; doctor directory (filter by name, specialty, location, date) and slots (available / unavailable / booked, from real DB bookings); appointment booking, lookup by reference + phone, reschedule, cancel; medicine catalog, cart, checkout with prescription details for Rx items (sign-in required); sign-up/sign-in/sign-out, profile, my appointments and orders; info, FAQ and feedback form.

## Structure
```
server/  schema.sql  src/index.js (API)  src/seed.js (demo data)  .env.example
client/  src/App.jsx (pages)  src/api.js  src/styles.css  .env.example
```

## Run
1. Create a database: `createdb bcroy`
2. `cd server && cp .env.example .env` (set `DATABASE_URL`, and `JWT_SECRET`: `openssl rand -hex 32`)
3. `npm install && npm run seed && npm run dev` (API on :4000)
4. `cd client && cp .env.example .env && npm install && npm run dev` (app on :5173)

## Security notes
Passwords hashed with bcrypt; JWT in an httpOnly, SameSite=Lax cookie (Secure in production); zod validation on the server plus client checks; helmet, rate limits, CORS limited to `CLIENT_ORIGIN`; secrets only in `.env`. Use HTTPS in production.

## Integration placeholders (not implemented)
Hospital scheduling system (slots come from working hours + DB bookings), pharmacy/inventory system, prescription file storage (only text details are saved), SMS/email confirmations, online payment.
