drop table if exists feedback,order_items,orders,medicines,appointments,doctors,users cascade;
create table users(id serial primary key,email text unique not null,name text not null,phone text not null,address text not null default '',pw_hash text not null,created_at timestamptz default now());
create table doctors(id serial primary key,name text not null,specialty text not null,qualifications text,languages text[],location text,visit_types text[],hours text,days int[],start_hour int,end_hour int);
create table appointments(id serial primary key,ref text unique not null,user_id int references users,doctor_id int not null references doctors,date date not null,time text not null,visit_type text not null,name text not null,phone text not null,email text not null,reason text not null,status text not null default 'booked',created_at timestamptz default now());
create unique index one_booking_per_slot on appointments(doctor_id,date,time) where status='booked';
create table medicines(id serial primary key,name text not null,category text,price_inr int not null,stock int not null,rx boolean not null default false,description text);
create table orders(id serial primary key,ref text unique not null,user_id int not null references users,name text,phone text,mode text,address text,rx_details text,total_inr int not null default 0,status text not null default 'received',created_at timestamptz default now());
create table order_items(order_id int references orders on delete cascade,medicine_id int references medicines,qty int,price_inr int);
create table feedback(id serial primary key,name text,rating int,comment text,created_at timestamptz default now());
