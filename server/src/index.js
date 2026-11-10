import 'dotenv/config'; import crypto from 'crypto'; import express from 'express'; import helmet from 'helmet'; import cors from 'cors'; import cookieParser from 'cookie-parser'; import rateLimit from 'express-rate-limit'; import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken'; import { z } from 'zod'; import pg from 'pg';
const { PORT = 4000, DATABASE_URL, JWT_SECRET, CLIENT_ORIGIN = 'http://localhost:5173', NODE_ENV } = process.env;
if (!DATABASE_URL || !JWT_SECRET || JWT_SECRET.length < 32) { console.error('Set DATABASE_URL and a 32+ char JWT_SECRET in server/.env'); process.exit(1) }

const db = new pg.Pool({ connectionString: DATABASE_URL }), q = (s, p) => db.query(s, p).then(r => r.rows);
const app = express(); app.use(helmet(), cors({ origin: CLIENT_ORIGIN, credentials: true }), express.json({ limit: '50kb' }), cookieParser(), rateLimit({ windowMs: 6e4, limit: 200 }));
const fail = (s, m) => { const e = new Error(m); e.status = s; throw e }, wrap = f => (a, b, c) => f(a, b, c).catch(c);
const parse = (s, d) => { const r = s.safeParse(d); if (!r.success) fail(400, r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')); return r.data };
app.use((req, res, next) => { try { req.uid = jwt.verify(req.cookies.t, JWT_SECRET).id } catch { } next() });
const need = (req, res, next) => req.uid ? next() : res.status(401).json({ error: 'Please sign in.' });
const setCookie = (res, id) => res.cookie('t', jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' }), { httpOnly: true, sameSite: 'lax', secure: NODE_ENV === 'production', maxAge: 6048e5 });
const phone = z.string().transform(s => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), time = z.string().regex(/^\d{2}:\d{2}$/), ref = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const pub = u => ({ id: u.id, email: u.email, name: u.name, phone: u.phone, address: u.address });
const lim = rateLimit({ windowMs: 9e5, limit: 30 });
app.post('/api/auth/signup', lim, wrap(async (req, res) => {
    const b = parse(z.object({ email: z.string().email().toLowerCase(), password: z.string().min(8).max(100), name: z.string().min(1).max(100), phone }), req.body);
    if ((await q('select 1 from users where email=$1', [b.email])).length) fail(409, 'An account with this email already exists.');
    const [u] = await q('insert into users(email,name,phone,pw_hash) values($1,$2,$3,$4) returning *', [b.email, b.name, b.phone, await bcrypt.hash(b.password, 12)]); setCookie(res, u.id); res.status(201).json(pub(u))
}));
app.post('/api/auth/login', lim, wrap(async (req, res) => {
    const b = parse(z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1) }), req.body); const [u] = await q('select * from users where email=$1', [b.email]);
    if (!u || !await bcrypt.compare(b.password, u.pw_hash)) fail(401, 'Incorrect email or password.'); setCookie(res, u.id); res.json(pub(u))
}));
app.post('/api/auth/logout', (req, res) => res.clearCookie('t').json({ ok: true }));
app.get('/api/me', need, wrap(async (req, res) => res.json(pub((await q('select * from users where id=$1', [req.uid]))[0]))));
app.patch('/api/me', need, wrap(async (req, res) => { const b = parse(z.object({ name: z.string().min(1).max(100), phone, address: z.string().max(300) }), req.body); res.json(pub((await q('update users set name=$1,phone=$2,address=$3 where id=$4 returning *', [b.name, b.phone, b.address, req.uid]))[0])) }));
/* INTEGRATION PLACEHOLDER: replace slot logic with the hospital scheduling system */
app.get('/api/doctors', wrap(async (req, res) => {
    const { q: s = '', specialty = '', location = '', date: d = '' } = req.query; const day = d ? new Date(d + 'T00:00:00Z').getUTCDay() : null;
    res.json(await q("select * from doctors where (name ilike $1 or specialty ilike $1) and ($2='' or specialty=$2) and ($3='' or location=$3) and ($4::int is null or $4=any(days)) order by name", [`%${s}%`, specialty, location, day]))
}));
async function slotsFor(id, d) {
    const [doc] = await q('select * from doctors where id=$1', [id]); if (!doc) fail(404, 'Doctor not found.'); if (!doc.days.includes(new Date(d + 'T00:00:00Z').getUTCDay())) return [];
    const booked = new Set((await q("select time from appointments where doctor_id=$1 and date=$2 and status='booked'", [id, d])).map(r => r.time)), out = [];
    for (let m = doc.start_hour * 60; m < doc.end_hour * 60; m += 30) { const t = `${String(m / 60 | 0).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; out.push({ time: t, status: booked.has(t) ? 'booked' : new Date(`${d}T${t}:00+05:30`) < new Date() ? 'unavailable' : 'available' }) } return out
}
app.get('/api/doctors/:id/slots', wrap(async (req, res) => res.json(await slotsFor(+req.params.id, parse(z.object({ date }), req.query).date))));
const dup = e => { if (e.code === '23505') fail(409, 'That slot was just taken. Please choose another.'); throw e };
const owns = (a, req, p) => (req.uid && a.user_id === req.uid) || (p && a.phone === p);
app.post('/api/appointments', wrap(async (req, res) => {
    const b = parse(z.object({ doctorId: z.number().int(), date, time, visitType: z.string(), name: z.string().min(1).max(100), phone, email: z.string().email(), reason: z.string().min(3).max(500) }), req.body);
    const [d] = await q('select * from doctors where id=$1 and $2=any(visit_types)', [b.doctorId, b.visitType]); if (!d) fail(400, 'Invalid doctor or visit type.');
    if ((await slotsFor(b.doctorId, b.date)).find(s => s.time === b.time)?.status !== 'available') fail(409, 'That slot is not available.');
    try { const [a] = await q('insert into appointments(ref,user_id,doctor_id,date,time,visit_type,name,phone,email,reason) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *', ['APT-' + ref(), req.uid || null, b.doctorId, b.date, b.time, b.visitType, b.name, b.phone, b.email, b.reason]); res.status(201).json(a) } catch (e) { dup(e) }
}));
app.get('/api/appointments', need, wrap(async (req, res) => res.json(await q("select a.*,d.name doctor,to_char(a.date,'YYYY-MM-DD') d from appointments a join doctors d on d.id=a.doctor_id where user_id=$1 order by a.date,a.time", [req.uid]))));
app.post('/api/appointments/lookup', wrap(async (req, res) => { const b = parse(z.object({ ref: z.string(), phone }), req.body); const [a] = await q("select a.*,d.name doctor,to_char(a.date,'YYYY-MM-DD') d from appointments a join doctors d on d.id=a.doctor_id where ref=$1 and a.phone=$2", [b.ref.toUpperCase(), b.phone]); a ? res.json(a) : fail(404, 'No appointment found for that reference and number.') }));
app.post('/api/appointments/:ref/cancel', wrap(async (req, res) => { const b = parse(z.object({ phone: phone.optional() }), req.body), [a] = await q('select * from appointments where ref=$1', [req.params.ref]); if (!a || !owns(a, req, b.phone)) fail(404, 'Appointment not found.'); res.json((await q("update appointments set status='cancelled' where id=$1 returning *", [a.id]))[0]) }));
app.post('/api/appointments/:ref/reschedule', wrap(async (req, res) => {
    const b = parse(z.object({ phone: phone.optional(), date, time }), req.body), [a] = await q("select * from appointments where ref=$1 and status='booked'", [req.params.ref]); if (!a || !owns(a, req, b.phone)) fail(404, 'Appointment not found.');
    if ((await slotsFor(a.doctor_id, b.date)).find(s => s.time === b.time)?.status !== 'available') fail(409, 'That slot is not available.');
    try { res.json((await q('update appointments set date=$1,time=$2 where id=$3 returning *', [b.date, b.time, a.id]))[0]) } catch (e) { dup(e) }
}));
/* INTEGRATION PLACEHOLDER: pharmacy inventory/dispatch; prescription file storage */
app.get('/api/medicines', wrap(async (req, res) => { const { q: s = '', category = '' } = req.query; res.json(await q("select * from medicines where name ilike $1 and ($2='' or category=$2) order by name", [`%${s}%`, category])) }));
app.post('/api/orders', need, wrap(async (req, res) => {
    const b = parse(z.object({ items: z.array(z.object({ id: z.number().int(), qty: z.number().int().min(1).max(9) })).min(1), mode: z.enum(['Delivery', 'Pickup']), address: z.string().max(300).default(''), name: z.string().min(1), phone, rxDetails: z.string().max(500).default('') }), req.body);
    if (b.mode === 'Delivery' && !b.address.trim()) fail(400, 'Address is required for delivery.'); const c = await db.connect();
    try {
        await c.query('begin'); let total = 0, rx = false; const { rows: [o] } = await c.query('insert into orders(ref,user_id,name,phone,mode,address,rx_details) values($1,$2,$3,$4,$5,$6,$7) returning *', ['ORD-' + ref(), req.uid, b.name, b.phone, b.mode, b.address, b.rxDetails]);
        for (const i of b.items) { const { rows: [m] } = await c.query('update medicines set stock=stock-$2 where id=$1 and stock>=$2 returning *', [i.id, i.qty]); if (!m) fail(409, 'An item is out of stock.'); rx = rx || m.rx; total += m.price_inr * i.qty; await c.query('insert into order_items values($1,$2,$3,$4)', [o.id, m.id, i.qty, m.price_inr]) }
        if (rx && !b.rxDetails.trim()) fail(400, 'Prescription details are required for prescription items.');
        const { rows: [f] } = await c.query('update orders set total_inr=$1,status=$2 where id=$3 returning *', [total, rx ? 'awaiting prescription review' : 'received', o.id]); await c.query('commit'); res.status(201).json(f)
    } catch (e) { await c.query('rollback'); throw e } finally { c.release() }
}));
app.get('/api/orders', need, wrap(async (req, res) => res.json(await q('select * from orders where user_id=$1 order by created_at desc', [req.uid]))));
app.post('/api/feedback', wrap(async (req, res) => { const b = parse(z.object({ name: z.string().max(100).default(''), rating: z.number().int().min(1).max(5), comment: z.string().min(1).max(1000) }), req.body); await q('insert into feedback(name,rating,comment) values($1,$2,$3)', [b.name, b.rating, b.comment]); res.status(201).json({ ok: true }) }));
app.use((e, req, res, next) => { if (!e.status) console.error(e); res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error' }) });
app.listen(PORT, () => console.log('API on :' + PORT));
