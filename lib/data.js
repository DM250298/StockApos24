// Lectura de datos y cálculos derivados (alertas, pedido).
// Se ejecuta en el cliente; recibe un cliente supabase ya creado.

export const TABLAS = [
  'config', 'profesionales', 'cajones', 'insumos', 'tratamientos', 'recetas',
  'instrumental', 'vencimientos', 'reposicion', 'registros', 'conteos', 'perfiles',
];

export async function fetchAll(supabase) {
  const results = await Promise.all(TABLAS.map((t) => supabase.from(t).select('*')));
  const db = {};
  TABLAS.forEach((t, i) => { db[t] = results[i].data || []; });

  // config es fila única
  db.config = (db.config && db.config[0]) || {
    nombre_consultorio: 'Consultorio Odontológico',
    profesionales_simultaneos: 4, factor_esterilizacion: 2, dias_aviso_vencimiento: 30,
  };

  // Ordenar
  db.profesionales.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  db.insumos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  db.cajones.sort((a, b) => a.codigo.localeCompare(b.codigo));
  db.registros.sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
  db.conteos.sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));

  // Adjuntar receta a cada tratamiento
  db.tratamientos = db.tratamientos.map((tr) => ({
    ...tr,
    receta: db.recetas.filter((r) => r.tratamiento_id === tr.id),
  }));

  return db;
}

export function diasHasta(fechaISO) {
  if (!fechaISO) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const obj = new Date(fechaISO);
  return Math.round((obj - hoy) / 86400000);
}

export function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function calcAlertas(db) {
  const bajoMinimo = db.insumos.filter(
    (i) => Number(i.stock_actual) <= Number(i.stock_minimo)
  );

  const dias = db.config.dias_aviso_vencimiento || 30;
  const byId = Object.fromEntries(db.insumos.map((i) => [i.id, i]));
  const porVencer = db.vencimientos
    .map((v) => ({ ...v, insumo: byId[v.insumo_id], dias: diasHasta(v.fecha_vencimiento) }))
    .filter((v) => v.dias !== null && v.dias <= dias)
    .sort((a, b) => a.dias - b.dias); // FEFO

  const instrumentalBajo = db.instrumental.filter(
    (x) => Number(x.dotacion_actual) < Number(x.dotacion_objetivo)
  );

  const reposicionPendiente = db.reposicion.filter((r) => !r.resuelto);

  return { bajoMinimo, porVencer, instrumentalBajo, reposicionPendiente };
}

export function armarPedido(db) {
  const a = calcAlertas(db);
  const lineas = [];

  a.bajoMinimo.forEach((i) => lineas.push({
    origen: 'Bajo mínimo', item: i.nombre, familia: i.familia, ubicacion: i.ubicacion,
    detalle: `Hay ${i.stock_actual} ${i.unidad}, mínimo ${i.stock_minimo}`,
    sugerido: Math.max(1, Number(i.stock_minimo) * 2 - Number(i.stock_actual)),
  }));

  a.instrumentalBajo.forEach((x) => lineas.push({
    origen: 'Instrumental bajo objetivo', item: x.nombre, familia: 'C', ubicacion: 'INST-1',
    detalle: `Operativos ${x.dotacion_actual}, objetivo ${x.dotacion_objetivo}`,
    sugerido: Number(x.dotacion_objetivo) - Number(x.dotacion_actual),
  }));

  a.porVencer.forEach((v) => lineas.push({
    origen: v.dias < 0 ? 'Vencido' : 'Por vencer',
    item: v.insumo ? v.insumo.nombre : '?', familia: v.insumo ? v.insumo.familia : '',
    ubicacion: v.insumo ? v.insumo.ubicacion : '',
    detalle: `Lote ${v.lote}, vence en ${v.dias} días`, sugerido: 1,
  }));

  a.reposicionPendiente.forEach((r) => lineas.push({
    origen: 'Marcado a mano', item: r.texto, familia: '', ubicacion: '',
    detalle: r.motivo || '', sugerido: 1,
  }));

  return { fecha: hoyISO(), lineas };
}
