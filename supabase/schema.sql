-- =====================================================================
--  Sistema de control de stock — Consultorio odontológico
--  ESQUEMA de base de datos (Supabase / PostgreSQL)
--
--  Cómo usarlo: en Supabase -> SQL Editor -> pegá TODO esto y "Run".
--  Después corré  seed.sql  para cargar los datos de ejemplo.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tablas ----------------------------------------------------

-- Configuración (una sola fila)
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

-- Maestro de insumos (familia A = discreto, B = granel)
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

-- Receta: qué insumos discretos descuenta cada tratamiento
create table if not exists recetas (
  id uuid primary key default gen_random_uuid(),
  tratamiento_id uuid not null references tratamientos(id) on delete cascade,
  insumo_id uuid not null references insumos(id) on delete cascade,
  cantidad int not null default 1
);

-- Registro diario
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

-- Conteos / reconciliaciones
create table if not exists conteos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  creado timestamptz not null default now(),
  persona text,
  detalle jsonb default '[]'::jsonb
);

-- Instrumental (familia C)
create table if not exists instrumental (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  dotacion_actual int not null default 0,
  dotacion_objetivo int not null default 0,
  estado text default 'operativo'
);

-- Vencimientos (lotes)
create table if not exists vencimientos (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid references insumos(id) on delete cascade,
  lote text default '',
  fecha_vencimiento date
);

-- Lista de reposición ("se está acabando")
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

create index if not exists idx_recetas_trat on recetas(tratamiento_id);
create index if not exists idx_venc_insumo on vencimientos(insumo_id);
create index if not exists idx_registros_fecha on registros(fecha desc);

-- ---------- Seguridad (RLS) ------------------------------------------
-- Modelo: UNA cuenta compartida del consultorio. Todo usuario logueado
-- (rol "authenticated") tiene acceso total. Sin login, nadie ve nada.

do $$
declare t text;
begin
  foreach t in array array[
    'config','profesionales','cajones','insumos','tratamientos','recetas',
    'registros','conteos','instrumental','vencimientos','reposicion'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "acceso_autenticado" on %I;', t);
    execute format(
      'create policy "acceso_autenticado" on %I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ---------- Realtime (sincronización en vivo) ------------------------
-- Agrega las tablas a la publicación de realtime (ignora si ya están).
do $$
declare t text;
begin
  foreach t in array array[
    'config','profesionales','cajones','insumos','tratamientos','recetas',
    'registros','conteos','instrumental','vencimientos','reposicion'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =====================================================================
--  FUNCIONES DE LÓGICA DE NEGOCIO (RPC)
--  security invoker => respetan las políticas RLS del usuario.
-- =====================================================================

-- Registrar un tratamiento: descuenta la receta (SOLO familia A) + extras.
create or replace function registrar_tratamiento(
  p_profesional text,
  p_tratamiento_id uuid,
  p_extras jsonb default '[]'::jsonb
) returns registros
language plpgsql security invoker
as $$
declare
  v_trat tratamientos;
  v_rec  record;
  v_ins  insumos;
  v_extra jsonb;
  v_cant int;
  v_movs jsonb := '[]'::jsonb;
  v_reg  registros;
begin
  select * into v_trat from tratamientos where id = p_tratamiento_id;
  if not found then raise exception 'Tratamiento no encontrado'; end if;

  -- Receta: solo los insumos de familia A descuentan cantidad.
  for v_rec in
    select r.insumo_id, r.cantidad, i.nombre, i.familia
    from recetas r join insumos i on i.id = r.insumo_id
    where r.tratamiento_id = p_tratamiento_id
  loop
    if v_rec.familia = 'A' then
      update insumos set stock_actual = stock_actual - v_rec.cantidad
        where id = v_rec.insumo_id;
      v_movs := v_movs || jsonb_build_object(
        'insumo_id', v_rec.insumo_id, 'nombre', v_rec.nombre, 'cantidad', v_rec.cantidad);
    end if;
  end loop;

  -- Extras fuera de receta.
  if p_extras is not null then
    for v_extra in select * from jsonb_array_elements(p_extras)
    loop
      v_cant := coalesce((v_extra->>'cantidad')::int, 0);
      select * into v_ins from insumos where id = (v_extra->>'insumo_id')::uuid;
      if found and v_cant > 0 then
        if v_ins.familia = 'A' then
          update insumos set stock_actual = stock_actual - v_cant where id = v_ins.id;
        end if;
        v_movs := v_movs || jsonb_build_object(
          'insumo_id', v_ins.id, 'nombre', v_ins.nombre, 'cantidad', v_cant);
      end if;
    end loop;
  end if;

  insert into registros (profesional, tipo, tratamiento_id, tratamiento_nombre, extras, movimientos)
  values (p_profesional, 'tratamiento', p_tratamiento_id, v_trat.nombre,
          coalesce(p_extras, '[]'::jsonb), v_movs)
  returning * into v_reg;

  return v_reg;
end $$;

-- Marcar envase vaciado (familia B): baja 1.
create or replace function marcar_envase(p_insumo_id uuid, p_profesional text)
returns insumos language plpgsql security invoker
as $$
declare v_ins insumos;
begin
  update insumos set stock_actual = stock_actual - 1
    where id = p_insumo_id returning * into v_ins;
  if not found then raise exception 'Insumo no encontrado'; end if;

  insert into registros (profesional, tipo, tratamiento_nombre, movimientos)
  values (p_profesional, 'envase_vaciado', 'Envase vaciado: ' || v_ins.nombre,
          jsonb_build_array(jsonb_build_object(
            'insumo_id', v_ins.id, 'nombre', v_ins.nombre, 'cantidad', 1)));
  return v_ins;
end $$;

-- Descartar fresa/lima: baja 1 y va a reposición.
create or replace function descartar_item(
  p_insumo_id uuid, p_profesional text, p_motivo text default 'Descartada por uso'
) returns insumos language plpgsql security invoker
as $$
declare v_ins insumos;
begin
  update insumos set stock_actual = stock_actual - 1
    where id = p_insumo_id returning * into v_ins;
  if not found then raise exception 'Insumo no encontrado'; end if;

  insert into registros (profesional, tipo, tratamiento_nombre, movimientos)
  values (p_profesional, 'descarte', 'Descarte: ' || v_ins.nombre,
          jsonb_build_array(jsonb_build_object(
            'insumo_id', v_ins.id, 'nombre', v_ins.nombre, 'cantidad', 1)));

  insert into reposicion (tipo, ref_id, texto, motivo, profesional)
  values ('descarte', v_ins.id, v_ins.nombre, p_motivo, p_profesional);
  return v_ins;
end $$;

-- Conteo / reconciliación: el físico pisa al teórico; guarda desvíos.
create or replace function registrar_conteo(p_persona text, p_items jsonb)
returns conteos language plpgsql security invoker
as $$
declare
  v_item jsonb; v_ins insumos; v_fisico int;
  v_detalle jsonb := '[]'::jsonb; v_cnt conteos;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_ins from insumos where id = (v_item->>'insumo_id')::uuid;
    if found and (v_item->>'fisico') is not null then
      v_fisico := (v_item->>'fisico')::int;
      v_detalle := v_detalle || jsonb_build_object(
        'insumo_id', v_ins.id, 'nombre', v_ins.nombre,
        'teorico', v_ins.stock_actual, 'fisico', v_fisico,
        'desvio', v_fisico - v_ins.stock_actual);
      update insumos set stock_actual = v_fisico where id = v_ins.id;
    end if;
  end loop;

  insert into conteos (persona, detalle) values (p_persona, v_detalle)
  returning * into v_cnt;
  return v_cnt;
end $$;
