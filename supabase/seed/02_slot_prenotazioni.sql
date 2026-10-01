-- Seed 2/2: agenda e prenotazioni fittizie da domani al 31/12/2028.
-- Lun-ven slot pieni, sabato metà slot, domenica e festivi nazionali chiusi.
-- Ogni slot è prenotato con probabilità quota_riempimento * (1 - 0.5 * distanza nel tempo):
-- le prossime settimane sono quasi piene, il 2028 è più libero.
-- Eseguire un anno alla volta (:anno = 2026, 2027, 2028) per stare nel timeout di 2 minuti.

-- 1. Slot
insert into public.slots (specialty_id, facility_id, professional_id, starts_at, ends_at, status)
select o.prestazione_id, o.struttura_id, o.medico_id,
       ((d::date + time '08:30' + make_interval(mins => n * p.durata_min)) at time zone 'Europe/Rome'),
       ((d::date + time '08:30' + make_interval(mins => (n + 1) * p.durata_min)) at time zone 'Europe/Rome'),
       'available'
-- cast a timestamp: senza, generate_series sceglie timestamptz e l'orario slitta
from generate_series(greatest(current_date + 1, make_date(:anno, 1, 1))::timestamp,
                     make_date(:anno, 12, 31)::timestamp, interval '1 day') d
cross join test_server.offerta o
join test_server.prestazioni p on p.id = o.prestazione_id
cross join lateral generate_series(0, case when extract(isodow from d) = 6
                                           then o.slot_giornalieri / 2 else o.slot_giornalieri end - 1) n
where extract(isodow from d) < 7
  and to_char(d, 'MM-DD') not in ('01-01','01-06','04-25','05-01','06-02','08-15','11-01','12-08','12-25','12-26')
  and d::date not in (date '2027-03-29', date '2028-04-17');  -- Pasquetta

-- 2. Prenotazioni fittizie su una parte degli slot, con paziente della stessa ASL.
with conteggi as (select asl_id, count(*) n from test_server.pazienti_fittizi group by asl_id),
     scelti as materialized (
       select s.*, st.asl_id, 1 + floor(random() * c.n)::int k
       from public.slots s
       join test_server.strutture st on st.id = s.facility_id
       join conteggi c on c.asl_id = st.asl_id
       where s.status = 'available'
         and s.starts_at >= make_date(:anno, 1, 1) and s.starts_at < make_date(:anno + 1, 1, 1)
         and not exists (select 1 from public.appointments a where a.slot_id = s.id)
         and random() < st.quota_riempimento
               * (1 - 0.5 * extract(epoch from s.starts_at - now())
                            / extract(epoch from timestamptz '2029-01-01' - now()))),
     nuove as (
       insert into public.appointments (patient_id, slot_id, specialty_id, facility_id, professional_id,
                                        starts_at, ends_at, status, source, created_at)
       select pf.user_id, s.id, s.specialty_id, s.facility_id, s.professional_id,
              s.starts_at, s.ends_at, 'booked', 'self_booking',
              now() - random() * interval '90 days'
       from scelti s
       join test_server.pazienti_fittizi pf on pf.asl_id = s.asl_id and pf.k = s.k
       returning id, slot_id)
update public.slots s
set status = 'booked', appointment_id = nuove.id, updated_at = now()
from nuove where nuove.slot_id = s.id;
