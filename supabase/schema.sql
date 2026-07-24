-- =====================================================================
--  Sistema de control de stock — Consultorio odontológico
--  ESQUEMA COMPLETO (tablas + usuarios/roles + seguridad + funciones)
--
--  Cómo usarlo: en Supabase -> SQL Editor -> pegá TODO esto y "Run".
--  Después corré  seed.sql  para cargar los datos de ejemplo.
--
--  Es SEGURO de re-ejecutar: no borra datos y siempre deja el modelo
--  de permisos correcto. NO hay ningún estado en el que las tablas
--  queden abiertas: la seguridad por rol es parte de este único script.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tablas ----------------------------------------------------

create table if not exists config (
  id boolean primary key default true,
  nombre_consultorio text not null default 'Consultorio Odontológico',
  profesionales_simultaneos int not null default 4,
  factor_esterilizacion int not null default 2,
  dias_aviso_vencimiento int not null default 30,
  constraint config_singleton check (id)
);

create table if not exists profesionales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int default 0
);

create table if not exists cajones (
  codigo text primary key,
  descripcion text default ''
);

create table if not exists insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  familia text not null default 'A' check (familia in ('A','B','C')),
  categoria text default '',
  unidad text default 'unidad',
  stock_actual int not null default 0,
  stock_minimo int not null default 0,
  ubicacion text references cajones(codigo) on delete set null,
  vence boolean not null default false,
  descartable boolean not null default false,
  creado timestamptz default now()
);

create table if not exists tratamientos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null
);

create table if not exists recetas (
  id uuid primary key default gen_random_uuid(),
  tratamiento_id uuid not null references tratamientos(id) on delete cascade,
  insumo_id uuid not null references insumos(id) on delete cascade,
  cantidad int not null default 1
);

create table if not exists registros (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  creado timestamptz not null default now(),
  profesional text,
  tipo text default 'tratamiento',
  tratamiento_id uuid,
  tratamiento_nombre text,
  extras jsonb default '[]'::jsonb,
  movimientos jsonb default '[]'::jsonb
);

create table if not exists conteos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  creado timestamptz not null default now(),
  persona text,
  detalle jsonb default '[]'::jsonb
);

create table if not exists instrumental (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  dotacion_actual int not null default 0,
  dotacion_objetivo int not null default 0,
  estado text default 'operativo'
);

create table if not exists vencimientos (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid references insumos(id) on delete cascade,
  lote text default '',
  fecha_vencimiento date
);

create table if not exists reposicion (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  creado timestamptz not null default now(),
  tipo text default 'manual',
  ref_id uuid,
  texto text not null,
  motivo text default '',
  profesional text default '',
  resuelto boolean not null default false
);

-- Perfil de cada usuario: su nombre visible y su rol.
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre text not null default 'Usuario',
  rol text not null default 'odontologo' check (rol in ('admin','odontologo')),
  creado timestamptz default now()
);

create index if not exists idx_recetas_trat on recetas(tratamiento_id);
create index if not exists idx_venc_insumo on vencimientos(insumo_id);
create index if not exists idx_registros_fecha on registros(fecha desc);

-- =====================================================================
--  USUARIOS Y ROLES
-- =====================================================================

-- ¿El usuario actual es admin? (se usa en todas las políticas)
create or replace function es_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin'); $$;

-- Al crear un usuario: se le crea el perfil. El PRIMER usuario del
-- sistema queda admin automáticamente; el resto, odontólogo.
create or replace function crear_perfil_nuevo()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into perfiles (id, email, nombre, rol)
  values (new.id, new.email, coalesce(new.email, 'Usuario'),
    case when exists (select 1 from perfiles where rol = 'admin') then 'odontologo' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function crear_perfil_nuevo();

-- Backfill: usuarios que ya existían sin perfil quedan admin.
insert into perfiles (id, email, nombre, rol)
select id, email, coalesce(email, 'Admin'), 'admin' from auth.users
on conflict (id) do nothing;

-- Sella el autor de registros/reposición con el nombre del usuario
-- logueado (no se puede falsificar desde el cliente).
create or replace function sellar_autor()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.profesional := coalesce((select nombre from perfiles where id = auth.uid()), new.profesional);
  return new;
end $$;

drop trigger if exists sellar_registros on registros;
create trigger sellar_registros before insert on registros
  for each row execute function sellar_autor();
drop trigger if exists sellar_reposicion on reposicion;
create trigger sellar_reposicion before insert on reposicion
  for each row execute function sellar_autor();

-- =====================================================================
--  SEGURIDAD (RLS) — por rol. Sin login no se ve nada.
--   - Maestro (insumos, etc.): leer todos, escribir SOLO admin.
--   - registros / reposición: insertar cualquiera logueado; modificar admin.
--   - conteos: solo admin.
--   - perfiles: leer todos, escribir admin.
-- =====================================================================

-- Habilitar RLS en todas las tablas.
do $$
declare t text;
begin
  foreach t in array array[
    'config','profesionales','cajones','insumos','tratamientos','recetas',
    'registros','conteos','instrumental','vencimientos','reposicion','perfiles'
  ] loop
    execute format('alter table %I enable row level security;', t);
    -- Limpiar cualquier política vieja (incluida la abierta de versiones previas)
    execute format('drop policy if exists "acceso_autenticado" on %I;', t);
    execute format('drop policy if exists "%s_select" on %I;', t, t);
    execute format('drop policy if exists "%s_admin_write" on %I;', t, t);
    execute format('drop policy if exists "%s_insert" on %I;', t, t);
    execute format('drop policy if exists "%s_admin_mod" on %I;', t, t);
    execute format('drop policy if exists "%s_admin_del" on %I;', t, t);
  end loop;
end $$;

-- Maestro + perfiles: leer todos, escribir solo admin.
do $$
declare t text;
begin
  foreach t in array array[
    'config','profesionales','cajones','insumos','tratamientos','recetas',
    'instrumental','vencimientos','perfiles'
  ] loop
    execute format('create policy "%s_select" on %I for select to authenticated using (true);', t, t);
    execute format('create policy "%s_admin_write" on %I for all to authenticated using (es_admin()) with check (es_admin());', t, t);
  end loop;
end $$;

-- Registros: leer todos; insertar cualquiera logueado; modificar/borrar admin.
create policy "registros_select" on registros for select to authenticated using (true);
create policy "registros_insert" on registros for insert to authenticated with check (true);
create policy "registros_admin_mod" on registros for update to authenticated using (es_admin()) with check (es_admin());
create policy "registros_admin_del" on registros for delete to authenticated using (es_admin());

-- Reposición: leer todos; anotar cualquiera; resolver/borrar admin.
create policy "reposicion_select" on reposicion for select to authenticated using (true);
create policy "reposicion_insert" on reposicion for insert to authenticated with check (true);
create policy "reposicion_admin_mod" on reposicion for update to authenticated using (es_admin()) with check (es_admin());
create policy "reposicion_admin_del" on reposicion for delete to authenticated using (es_admin());

-- Conteos: leer todos; escribir solo admin.
create policy "conteos_select" on conteos for select to authenticated using (true);
create policy "conteos_admin_write" on conteos for all to authenticated using (es_admin()) with check (es_admin());

-- ---------- Realtime (sincronización en vivo) ------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'config','profesionales','cajones','insumos','tratamientos','recetas',
    'registros','conteos','instrumental','vencimientos','reposicion','perfiles'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =====================================================================
--  FUNCIONES DE LÓGICA DE NEGOCIO (RPC)
--  SECURITY DEFINER: corren con permisos elevados para poder tocar el
--  stock aunque el que llama sea odontólogo. Por eso VALIDAN el input,
--  nunca dejan stock negativo, sellan el autor y solo las ejecuta un
--  usuario logueado (revoke a public/anon).
-- =====================================================================

-- Registrar un tratamiento: descuenta la receta (SOLO familia A) + extras.
create or replace function registrar_tratamiento(
  p_profesional text,
  p_tratamiento_id uuid,
  p_extras jsonb default '[]'::jsonb
) returns registros
language plpgsql security definer set search_path = public
as $$
declare
  v_trat tratamientos; v_rec record; v_ins insumos; v_extra jsonb;
  v_cant int; v_movs jsonb := '[]'::jsonb; v_reg registros; v_prof text;
begin
  v_prof := coalesce((select nombre from perfiles where id = auth.uid()), p_profesional);
  select * into v_trat from tratamientos where id = p_tratamiento_id;
  if not found then raise exception 'Tratamiento no encontrado'; end if;

  -- Receta: solo insumos de familia A descuentan cantidad (sin bajar de 0).
  for v_rec in
    select r.insumo_id, r.cantidad, i.nombre, i.familia
    from recetas r join insumos i on i.id = r.insumo_id
    where r.tratamiento_id = p_tratamiento_id
  loop
    if v_rec.familia = 'A' then
      update insumos set stock_actual = greatest(0, stock_actual - v_rec.cantidad)
        where id = v_rec.insumo_id;
      v_movs := v_movs || jsonb_build_object('insumo_id', v_rec.insumo_id, 'nombre', v_rec.nombre, 'cantidad', v_rec.cantidad);
    end if;
  end loop;

  -- Extras: solo insumos por unidad (familia A) y cantidad razonable (1..1000).
  if p_extras is not null then
    for v_extra in select * from jsonb_array_elements(p_extras)
    loop
      v_cant := coalesce((v_extra->>'cantidad')::int, 0);
      select * into v_ins from insumos where id = (v_extra->>'insumo_id')::uuid;
      if found and v_ins.familia = 'A' and v_cant >= 1 and v_cant <= 1000 then
        update insumos set stock_actual = greatest(0, stock_actual - v_cant) where id = v_ins.id;
        v_movs := v_movs || jsonb_build_object('insumo_id', v_ins.id, 'nombre', v_ins.nombre, 'cantidad', v_cant);
      end if;
    end loop;
  end if;

  insert into registros (profesional, tipo, tratamiento_id, tratamiento_nombre, extras, movimientos)
  values (v_prof, 'tratamiento', p_tratamiento_id, v_trat.nombre, coalesce(p_extras, '[]'::jsonb), v_movs)
  returning * into v_reg;
  return v_reg;
end $$;

-- Marcar envase vaciado (SOLO familia B): baja 1, sin bajar de 0.
create or replace function marcar_envase(p_insumo_id uuid, p_profesional text)
returns insumos language plpgsql security definer set search_path = public
as $$
declare v_ins insumos; v_prof text;
begin
  v_prof := coalesce((select nombre from perfiles where id = auth.uid()), p_profesional);
  select * into v_ins from insumos where id = p_insumo_id;
  if not found then raise exception 'Insumo no encontrado'; end if;
  if v_ins.familia <> 'B' then raise exception 'Ese insumo no es de granel'; end if;

  update insumos set stock_actual = greatest(0, stock_actual - 1)
    where id = v_ins.id returning * into v_ins;
  insert into registros (profesional, tipo, tratamiento_nombre, movimientos)
  values (v_prof, 'envase_vaciado', 'Envase vaciado: ' || v_ins.nombre,
          jsonb_build_array(jsonb_build_object('insumo_id', v_ins.id, 'nombre', v_ins.nombre, 'cantidad', 1)));
  return v_ins;
end $$;

-- Descartar fresa/lima (SOLO descartables): baja 1 y va a reposición.
create or replace function descartar_item(
  p_insumo_id uuid, p_profesional text, p_motivo text default 'Descartada por uso'
) returns insumos language plpgsql security definer set search_path = public
as $$
declare v_ins insumos; v_prof text;
begin
  v_prof := coalesce((select nombre from perfiles where id = auth.uid()), p_profesional);
  select * into v_ins from insumos where id = p_insumo_id;
  if not found then raise exception 'Insumo no encontrado'; end if;
  if not v_ins.descartable then raise exception 'Ese insumo no es descartable'; end if;

  update insumos set stock_actual = greatest(0, stock_actual - 1)
    where id = v_ins.id returning * into v_ins;
  insert into registros (profesional, tipo, tratamiento_nombre, movimientos)
  values (v_prof, 'descarte', 'Descarte: ' || v_ins.nombre,
          jsonb_build_array(jsonb_build_object('insumo_id', v_ins.id, 'nombre', v_ins.nombre, 'cantidad', 1)));
  insert into reposicion (tipo, ref_id, texto, motivo, profesional)
  values ('descarte', v_ins.id, v_ins.nombre, p_motivo, v_prof);
  return v_ins;
end $$;

-- Conteo / reconciliación: SOLO admin. El físico pisa al teórico.
create or replace function registrar_conteo(p_persona text, p_items jsonb)
returns conteos language plpgsql security definer set search_path = public
as $$
declare
  v_item jsonb; v_ins insumos; v_fisico int;
  v_detalle jsonb := '[]'::jsonb; v_cnt conteos; v_pers text;
begin
  if not es_admin() then
    raise exception 'Solo un administrador puede registrar el conteo';
  end if;
  v_pers := coalesce((select nombre from perfiles where id = auth.uid()), p_persona);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_ins from insumos where id = (v_item->>'insumo_id')::uuid;
    if found and (v_item->>'fisico') is not null then
      v_fisico := greatest(0, (v_item->>'fisico')::int);
      v_detalle := v_detalle || jsonb_build_object(
        'insumo_id', v_ins.id, 'nombre', v_ins.nombre,
        'teorico', v_ins.stock_actual, 'fisico', v_fisico,
        'desvio', v_fisico - v_ins.stock_actual);
      update insumos set stock_actual = v_fisico where id = v_ins.id;
    end if;
  end loop;

  insert into conteos (persona, detalle) values (v_pers, v_detalle)
  returning * into v_cnt;
  return v_cnt;
end $$;

-- Solo usuarios logueados pueden ejecutar las funciones de acción
-- (nunca 'anon' con la sola clave pública).
revoke execute on function registrar_tratamiento(text, uuid, jsonb) from public;
revoke execute on function marcar_envase(uuid, text) from public;
revoke execute on function descartar_item(uuid, text, text) from public;
revoke execute on function registrar_conteo(text, jsonb) from public;
grant execute on function registrar_tratamiento(text, uuid, jsonb) to authenticated;
grant execute on function marcar_envase(uuid, text) to authenticated;
grant execute on function descartar_item(uuid, text, text) to authenticated;
grant execute on function registrar_conteo(text, jsonb) to authenticated;
