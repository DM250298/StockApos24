-- =====================================================================
--  Datos de EJEMPLO. Corré esto DESPUÉS de schema.sql.
--  (Se puede volver a correr: primero limpia y vuelve a cargar.)
--  Agus reemplaza estos datos por los reales desde la propia app.
-- =====================================================================

truncate recetas, registros, conteos, vencimientos, reposicion,
         tratamientos, instrumental, insumos, cajones, profesionales
  restart identity cascade;

-- Configuración (fila única)
insert into config (id, nombre_consultorio, profesionales_simultaneos, factor_esterilizacion, dias_aviso_vencimiento)
values (true, 'Consultorio Odontológico', 4, 2, 30)
on conflict (id) do update set
  nombre_consultorio = excluded.nombre_consultorio,
  profesionales_simultaneos = excluded.profesionales_simultaneos,
  factor_esterilizacion = excluded.factor_esterilizacion,
  dias_aviso_vencimiento = excluded.dias_aviso_vencimiento;

-- Profesionales
insert into profesionales (nombre, orden) values
  ('Agus', 1), ('Dra. Martínez', 2), ('Dr. López', 3), ('Dra. Gómez', 4);

-- Cajones / ubicaciones
insert into cajones (codigo, descripcion) values
  ('ANE-1', 'Anestesia'),
  ('BIO-1', 'Bioseguridad'),
  ('OP-1',  'Operatoria / Restauración'),
  ('END-1', 'Endodoncia'),
  ('CIR-1', 'Cirugía'),
  ('INST-1','Instrumental');

-- Insumos (familia A = discreto, B = granel)
insert into insumos (nombre, familia, categoria, unidad, stock_actual, stock_minimo, ubicacion, vence, descartable) values
  -- Familia A
  ('Guantes de nitrilo',                 'A', 'Bioseguridad', 'caja',   12,  4, 'BIO-1', false, false),
  ('Barbijos',                           'A', 'Bioseguridad', 'caja',    8,  3, 'BIO-1', false, false),
  ('Campos descartables',                'A', 'Bioseguridad', 'unidad', 60, 20, 'BIO-1', false, false),
  ('Eyectores',                          'A', 'Bioseguridad', 'unidad', 90, 30, 'BIO-1', false, false),
  ('Bolsas de esterilización (pouch)',           'A', 'Bioseguridad', 'unidad',120, 50, 'BIO-1', false, false),
  ('Rollos de algodón',                  'A', 'Operatoria',   'unidad',200, 60, 'OP-1',  false, false),
  ('Agujas cortas (para carpule)',                      'A', 'Anestesia',    'unidad', 45, 20, 'ANE-1', true,  false),
  ('Carpules de anestesia (lidocaína)',  'A', 'Anestesia',    'unidad', 70, 30, 'ANE-1', true,  false),
  ('Matrices',                           'A', 'Operatoria',   'unidad', 40, 15, 'OP-1',  false, false),
  ('Cuñas de madera',                    'A', 'Operatoria',   'unidad', 50, 20, 'OP-1',  false, false),
  ('Suturas (hilo de sutura)',                            'A', 'Cirugía',      'sobre',  25, 10, 'CIR-1', true,  false),
  ('Goma dique (dique de goma)',                      'A', 'Endodoncia',   'unidad', 30, 10, 'END-1', false, false),
  ('Limas de endodoncia',                'A', 'Endodoncia',   'unidad', 60, 20, 'END-1', false, true),
  ('Fresas',                             'A', 'Operatoria',   'unidad', 40, 15, 'OP-1',  false, true),
  -- Familia B (por envase)
  ('Resina (composite)',                   'B', 'Operatoria',   'jeringa',10,  4, 'OP-1',  true,  false),
  ('Ácido grabador (ácido fosfórico)',                     'B', 'Operatoria',   'jeringa', 6,  2, 'OP-1',  true,  false),
  ('Adhesivo (bonding)',                           'B', 'Operatoria',   'frasco',  4,  2, 'OP-1',  true,  false),
  ('Hipoclorito de sodio',               'B', 'Endodoncia',   'frasco',  5,  2, 'END-1', true,  false),
  ('Alginato',                           'B', 'Prótesis',     'envase',  3,  1, 'OP-1',  true,  false),
  ('Silicona de impresión',              'B', 'Prótesis',     'envase',  2,  1, 'OP-1',  true,  false),
  ('Ionómero de vidrio',                 'B', 'Operatoria',   'frasco',  3,  1, 'OP-1',  true,  false);

-- Tratamientos
insert into tratamientos (nombre) values
  ('Consulta / Diagnóstico'),
  ('Obturación (arreglo)'),
  ('Endodoncia (conducto)'),
  ('Extracción'),
  ('Limpieza / Profilaxis');

-- Recetas (referencian insumos y tratamientos por nombre)
insert into recetas (tratamiento_id, insumo_id, cantidad)
select t.id, i.id, v.cantidad
from (values
  ('Consulta / Diagnóstico', 'Guantes de nitrilo', 1),
  ('Consulta / Diagnóstico', 'Barbijos', 1),
  ('Consulta / Diagnóstico', 'Campos descartables', 1),
  ('Consulta / Diagnóstico', 'Eyectores', 1),

  ('Obturación (arreglo)', 'Guantes de nitrilo', 1),
  ('Obturación (arreglo)', 'Campos descartables', 1),
  ('Obturación (arreglo)', 'Eyectores', 1),
  ('Obturación (arreglo)', 'Agujas cortas (para carpule)', 1),
  ('Obturación (arreglo)', 'Carpules de anestesia (lidocaína)', 1),
  ('Obturación (arreglo)', 'Matrices', 1),
  ('Obturación (arreglo)', 'Cuñas de madera', 1),
  ('Obturación (arreglo)', 'Fresas', 1),
  ('Obturación (arreglo)', 'Rollos de algodón', 2),

  ('Endodoncia (conducto)', 'Guantes de nitrilo', 1),
  ('Endodoncia (conducto)', 'Campos descartables', 1),
  ('Endodoncia (conducto)', 'Eyectores', 1),
  ('Endodoncia (conducto)', 'Agujas cortas (para carpule)', 1),
  ('Endodoncia (conducto)', 'Carpules de anestesia (lidocaína)', 2),
  ('Endodoncia (conducto)', 'Goma dique (dique de goma)', 1),
  ('Endodoncia (conducto)', 'Limas de endodoncia', 3),
  ('Endodoncia (conducto)', 'Rollos de algodón', 2),

  ('Extracción', 'Guantes de nitrilo', 1),
  ('Extracción', 'Campos descartables', 1),
  ('Extracción', 'Eyectores', 1),
  ('Extracción', 'Agujas cortas (para carpule)', 1),
  ('Extracción', 'Carpules de anestesia (lidocaína)', 2),
  ('Extracción', 'Suturas (hilo de sutura)', 1),

  ('Limpieza / Profilaxis', 'Guantes de nitrilo', 1),
  ('Limpieza / Profilaxis', 'Barbijos', 1),
  ('Limpieza / Profilaxis', 'Campos descartables', 1),
  ('Limpieza / Profilaxis', 'Eyectores', 1)
) as v(tratamiento, insumo, cantidad)
join tratamientos t on t.nombre = v.tratamiento
join insumos i on i.nombre = v.insumo;

-- Instrumental (objetivo = 4 simultáneos × 2 esterilización = 8)
insert into instrumental (nombre, dotacion_actual, dotacion_objetivo, estado) values
  ('Espejos bucales',        9, 8, 'operativo'),
  ('Pinzas',                 8, 8, 'operativo'),
  ('Exploradores',           6, 8, 'operativo'),
  ('Cucharitas de dentina',  8, 8, 'operativo'),
  ('Fórceps',                5, 8, 'operativo'),
  ('Jeringas Carpule',       8, 8, 'operativo'),
  ('Sondas periodontales',   7, 8, 'operativo');

-- Vencimientos de ejemplo (fechas relativas a hoy)
insert into vencimientos (insumo_id, lote, fecha_vencimiento)
select i.id, v.lote, v.fecha
from (values
  ('Carpules de anestesia (lidocaína)', 'L-2024-A', current_date + 20),
  ('Resina (composite)',                  'R-8891',   current_date + 300),
  ('Suturas (hilo de sutura)',                           'S-1120',   current_date - 5),
  ('Adhesivo (bonding)',                          'AD-5521',  current_date + 20)
) as v(insumo, lote, fecha)
join insumos i on i.nombre = v.insumo;
