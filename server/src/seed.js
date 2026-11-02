import 'dotenv/config';import fs from 'fs';import pg from 'pg';
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
await db.query(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
const D=[['Dr. A. Sen (sample)','Cardiology','MD, DM Cardiology',['English','Bengali','Hindi'],'Main Hospital, OPD A',['In person','Video'],'Mon–Fri 10:00–14:00',[1,2,3,4,5],10,14],
['Dr. R. Das (sample)','General Medicine','MBBS, MD Medicine',['English','Bengali'],'Main Hospital, OPD B',['In person'],'Mon–Sat 09:00–13:00',[1,2,3,4,5,6],9,13],
['Dr. S. Banerjee (sample)','Paediatrics','MBBS, DCH, MD',['Bengali','Hindi','English'],'Main Hospital, Child Wing',['In person','Video'],'Tue–Sat 11:00–15:00',[2,3,4,5,6],11,15],
['Dr. P. Mahato (sample)','Orthopaedics','MBBS, MS Ortho',['Bengali','Hindi'],'Main Hospital, OPD C',['In person'],'Mon, Wed, Fri 14:00–17:00',[1,3,5],14,17],
['Dr. N. Roy (sample)','Gynaecology','MBBS, MS Obs & Gynae',['English','Bengali'],'City Clinic',['In person','Video'],'Mon–Fri 10:00–13:00',[1,2,3,4,5],10,13],
['Dr. K. Ghosh (sample)','Dermatology','MBBS, MD Dermatology',['English','Hindi','Bengali'],'City Clinic',['In person','Video'],'Tue, Thu, Sat 15:00–18:00',[2,4,6],15,18]];
for(const d of D)await db.query('insert into doctors(name,specialty,qualifications,languages,location,visit_types,hours,days,start_hour,end_hour) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',d);
const M=[['Paracetamol 500 mg (10 tabs)','Pain & fever',20,40,false,'Mild pain and fever. Follow label.'],['ORS sachet (pack of 5)','Hydration',45,25,false,'Oral rehydration salts.'],['Cetirizine 10 mg (10 tabs)','Allergy',30,6,false,'Antihistamine.'],['Amoxicillin 500 mg (10 caps)','Antibiotics',85,30,true,'Antibiotic. Prescription required.'],['Metformin 500 mg (15 tabs)','Diabetes',35,0,true,'Prescription required.'],['Amlodipine 5 mg (15 tabs)','Heart & BP',40,22,true,'Prescription required.']];
for(const m of M)await db.query('insert into medicines(name,category,price_inr,stock,rx,description) values($1,$2,$3,$4,$5,$6)',m);
console.log('Seeded DEMO data');await db.end();
