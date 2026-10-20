-- Rôle de la personne connectée, d'après le compte utilisé
create or replace function public.role_carnet() returns text
language sql stable security invoker set search_path = ''
as $f$
  select case auth.jwt() ->> 'email'
    when 'parents.noah@example.com' then 'parents'
    when 'famille.noah@example.com' then 'famille'
  end
$f$;

-- On repart de zéro : plus aucun accès sans connexion
do $d$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $d$;
revoke all on all tables in schema public from anon;

-- Pages des parents : tout le monde connecté lit, seuls les parents écrivent
do $d$ declare t text; begin
  foreach t in array array['biberons','couches','sommeils','sante_profil','rendez_vous','mesures','suivi_calendrier','medicaments_prises'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy "lecture famille et parents" on public.%I for select to authenticated using ((select public.role_carnet()) in ('parents','famille'))$p$, t);
    execute format($p$create policy "ajout parents" on public.%I for insert to authenticated with check ((select public.role_carnet()) = 'parents')$p$, t);
    execute format($p$create policy "modif parents" on public.%I for update to authenticated using ((select public.role_carnet()) = 'parents') with check ((select public.role_carnet()) = 'parents')$p$, t);
    execute format($p$create policy "suppression parents" on public.%I for delete to authenticated using ((select public.role_carnet()) = 'parents')$p$, t);
  end loop;
end $d$;

-- Espace garde : la famille (et les parents) lisent et écrivent
do $d$ declare t text; begin
  foreach t in array array['garde_jours','garde_evenements'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy "garde lecture" on public.%I for select to authenticated using ((select public.role_carnet()) in ('parents','famille'))$p$, t);
    execute format($p$create policy "garde ajout" on public.%I for insert to authenticated with check ((select public.role_carnet()) in ('parents','famille'))$p$, t);
    execute format($p$create policy "garde modif" on public.%I for update to authenticated using ((select public.role_carnet()) in ('parents','famille')) with check ((select public.role_carnet()) in ('parents','famille'))$p$, t);
    execute format($p$create policy "garde suppression" on public.%I for delete to authenticated using ((select public.role_carnet()) in ('parents','famille'))$p$, t);
  end loop;
end $d$;
