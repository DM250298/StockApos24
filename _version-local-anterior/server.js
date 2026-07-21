/* =====================================================================
   Sistema de control de stock — Consultorio odontológico
   Servidor local (cero dependencias: solo Node nativo).

   Corre en la computadora del consultorio y queda accesible desde
   los celulares de los profesionales por la red wifi.

   Datos: un solo archivo JSON (data/db.json) + backups automáticos.
   ===================================================================== */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 4321;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// --------------------------------------------------------------------
// Persistencia
// --------------------------------------------------------------------
let db = null;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function loadDB() {
  ensureDirs();
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      console.error('⚠️  db.json ilegible, se usa una copia de seguridad si existe.');
      db = seedDB();
      saveDB();
    }
  } else {
    db = seedDB();
    saveDB();
  }
  // Backup diario (una vez por día)
  backupIfNeeded();
}

// Escritura atómica: escribe a un temporal y renombra.
function saveDB() {
  ensureDirs();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function backupIfNeeded() {
  try {
    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const file = path.join(BACKUP_DIR, `db-${stamp}.json`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(db, null, 2), 'utf8');
      // Conservar solo los últimos 30 backups
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('db-') && f.endsWith('.json'))
        .sort();
      while (files.length > 30) {
        const old = files.shift();
        try { fs.unlinkSync(path.join(BACKUP_DIR, old)); } catch (_) {}
      }
    }
  } catch (e) {
    console.error('No se pudo crear backup:', e.message);
  }
}

// --------------------------------------------------------------------
// Utilidades
// --------------------------------------------------------------------
let idCounter = 1;
function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function diasHasta(fechaISO) {
  if (!fechaISO) return null;
  const hoyMs = new Date(hoy()).getTime();
  const objMs = new Date(fechaISO).getTime();
  return Math.round((objMs - hoyMs) / (1000 * 60 * 60 * 24));
}

// --------------------------------------------------------------------
// Datos de ejemplo (Agus los reemplaza por los reales sin tocar código)
// --------------------------------------------------------------------
function seedDB() {
  // Cajones / ubicaciones físicas
  const cajones = [
    { codigo: 'ANE-1', descripcion: 'Anestesia' },
    { codigo: 'BIO-1', descripcion: 'Bioseguridad' },
    { codigo: 'OP-1', descripcion: 'Operatoria / Restauración' },
    { codigo: 'END-1', descripcion: 'Endodoncia' },
    { codigo: 'CIR-1', descripcion: 'Cirugía' },
    { codigo: 'INST-1', descripcion: 'Instrumental' },
  ];

  // Maestro de insumos (familias A = discreto, B = granel)
  // stockActual = stock teórico actual
  const insumos = [
    // --- Familia A: consumibles discretos ---
    { nombre: 'Guantes de nitrilo', familia: 'A', categoria: 'Bioseguridad', unidad: 'caja', stockActual: 12, stockMinimo: 4, ubicacion: 'BIO-1', vence: false },
    { nombre: 'Barbijos', familia: 'A', categoria: 'Bioseguridad', unidad: 'caja', stockActual: 8, stockMinimo: 3, ubicacion: 'BIO-1', vence: false },
    { nombre: 'Campos descartables', familia: 'A', categoria: 'Bioseguridad', unidad: 'unidad', stockActual: 60, stockMinimo: 20, ubicacion: 'BIO-1', vence: false },
    { nombre: 'Eyectores', familia: 'A', categoria: 'Bioseguridad', unidad: 'unidad', stockActual: 90, stockMinimo: 30, ubicacion: 'BIO-1', vence: false },
    { nombre: 'Bolsas de esterilización', familia: 'A', categoria: 'Bioseguridad', unidad: 'unidad', stockActual: 120, stockMinimo: 50, ubicacion: 'BIO-1', vence: false },
    { nombre: 'Rollos de algodón', familia: 'A', categoria: 'Operatoria', unidad: 'unidad', stockActual: 200, stockMinimo: 60, ubicacion: 'OP-1', vence: false },
    { nombre: 'Agujas cortas', familia: 'A', categoria: 'Anestesia', unidad: 'unidad', stockActual: 45, stockMinimo: 20, ubicacion: 'ANE-1', vence: true },
    { nombre: 'Carpules de anestesia (lidocaína)', familia: 'A', categoria: 'Anestesia', unidad: 'unidad', stockActual: 70, stockMinimo: 30, ubicacion: 'ANE-1', vence: true },
    { nombre: 'Matrices', familia: 'A', categoria: 'Operatoria', unidad: 'unidad', stockActual: 40, stockMinimo: 15, ubicacion: 'OP-1', vence: false },
    { nombre: 'Cuñas de madera', familia: 'A', categoria: 'Operatoria', unidad: 'unidad', stockActual: 50, stockMinimo: 20, ubicacion: 'OP-1', vence: false },
    { nombre: 'Suturas', familia: 'A', categoria: 'Cirugía', unidad: 'sobre', stockActual: 25, stockMinimo: 10, ubicacion: 'CIR-1', vence: true },
    { nombre: 'Dique de goma', familia: 'A', categoria: 'Endodoncia', unidad: 'unidad', stockActual: 30, stockMinimo: 10, ubicacion: 'END-1', vence: false },
    // Caso borde: limas y fresas (reutilizables con descarte por uso)
    { nombre: 'Limas de endodoncia', familia: 'A', categoria: 'Endodoncia', unidad: 'unidad', stockActual: 60, stockMinimo: 20, ubicacion: 'END-1', vence: false, descartable: true },
    { nombre: 'Fresas', familia: 'A', categoria: 'Operatoria', unidad: 'unidad', stockActual: 40, stockMinimo: 15, ubicacion: 'OP-1', vence: false, descartable: true },

    // --- Familia B: consumibles a granel (se cuentan por envase) ---
    { nombre: 'Resina compuesta', familia: 'B', categoria: 'Operatoria', unidad: 'jeringa', stockActual: 10, stockMinimo: 4, ubicacion: 'OP-1', vence: true },
    { nombre: 'Ácido grabador', familia: 'B', categoria: 'Operatoria', unidad: 'jeringa', stockActual: 6, stockMinimo: 2, ubicacion: 'OP-1', vence: true },
    { nombre: 'Adhesivo', familia: 'B', categoria: 'Operatoria', unidad: 'frasco', stockActual: 4, stockMinimo: 2, ubicacion: 'OP-1', vence: true },
    { nombre: 'Hipoclorito de sodio', familia: 'B', categoria: 'Endodoncia', unidad: 'frasco', stockActual: 5, stockMinimo: 2, ubicacion: 'END-1', vence: true },
    { nombre: 'Alginato', familia: 'B', categoria: 'Prótesis', unidad: 'envase', stockActual: 3, stockMinimo: 1, ubicacion: 'OP-1', vence: true },
    { nombre: 'Silicona de impresión', familia: 'B', categoria: 'Prótesis', unidad: 'envase', stockActual: 2, stockMinimo: 1, ubicacion: 'OP-1', vence: true },
    { nombre: 'Ionómero de vidrio', familia: 'B', categoria: 'Operatoria', unidad: 'frasco', stockActual: 3, stockMinimo: 1, ubicacion: 'OP-1', vence: true },
  ].map(i => ({ id: newId('ins'), descartable: false, ...i }));

  // Índice por nombre para armar recetas
  const byName = {};
  insumos.forEach(i => { byName[i.nombre] = i.id; });

  // Tratamientos con receta (solo insumos discretos / familia A)
  const tratamientos = [
    {
      nombre: 'Consulta / Diagnóstico',
      receta: [
        ['Guantes de nitrilo', 1], ['Barbijos', 1], ['Campos descartables', 1], ['Eyectores', 1],
      ],
    },
    {
      nombre: 'Restauración (obturación)',
      receta: [
        ['Guantes de nitrilo', 1], ['Campos descartables', 1], ['Eyectores', 1],
        ['Agujas cortas', 1], ['Carpules de anestesia (lidocaína)', 1],
        ['Matrices', 1], ['Cuñas de madera', 1], ['Fresas', 1], ['Rollos de algodón', 2],
      ],
    },
    {
      nombre: 'Endodoncia (conducto)',
      receta: [
        ['Guantes de nitrilo', 1], ['Campos descartables', 1], ['Eyectores', 1],
        ['Agujas cortas', 1], ['Carpules de anestesia (lidocaína)', 2],
        ['Dique de goma', 1], ['Limas de endodoncia', 3], ['Rollos de algodón', 2],
      ],
    },
    {
      nombre: 'Extracción',
      receta: [
        ['Guantes de nitrilo', 1], ['Campos descartables', 1], ['Eyectores', 1],
        ['Agujas cortas', 1], ['Carpules de anestesia (lidocaína)', 2], ['Suturas', 1],
      ],
    },
    {
      nombre: 'Limpieza / Profilaxis',
      receta: [
        ['Guantes de nitrilo', 1], ['Barbijos', 1], ['Campos descartables', 1], ['Eyectores', 1],
      ],
    },
  ].map(t => ({
    id: newId('trat'),
    nombre: t.nombre,
    receta: t.receta
      .filter(([n]) => byName[n])
      .map(([n, cant]) => ({ insumoId: byName[n], cantidad: cant })),
  }));

  // Instrumental (familia C — patrimonio)
  // dotacionObjetivo = profesionalesSimultaneos (4) × factorEsterilizacion (2)
  const factorEst = 2;
  const profSim = 4;
  const objetivo = profSim * factorEst; // 8
  const instrumental = [
    { nombre: 'Espejos bucales', dotacionActual: 9, dotacionObjetivo: objetivo, estado: 'operativo' },
    { nombre: 'Pinzas', dotacionActual: 8, dotacionObjetivo: objetivo, estado: 'operativo' },
    { nombre: 'Exploradores', dotacionActual: 6, dotacionObjetivo: objetivo, estado: 'operativo' },
    { nombre: 'Cucharitas de dentina', dotacionActual: 8, dotacionObjetivo: objetivo, estado: 'operativo' },
    { nombre: 'Fórceps', dotacionActual: 5, dotacionObjetivo: objetivo, estado: 'operativo' },
    { nombre: 'Jeringas Carpule', dotacionActual: 8, dotacionObjetivo: objetivo, estado: 'operativo' },
    { nombre: 'Sondas periodontales', dotacionActual: 7, dotacionObjetivo: objetivo, estado: 'operativo' },
  ].map(x => ({ id: newId('inst'), ...x }));

  // Vencimientos (lotes) de ejemplo
  const proximo = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  const lejano = new Date(Date.now() + 300 * 86400000).toISOString().slice(0, 10);
  const vencido = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  const vencimientos = [
    { id: newId('venc'), insumoId: byName['Carpules de anestesia (lidocaína)'], lote: 'L-2024-A', fechaVencimiento: proximo },
    { id: newId('venc'), insumoId: byName['Resina compuesta'], lote: 'R-8891', fechaVencimiento: lejano },
    { id: newId('venc'), insumoId: byName['Suturas'], lote: 'S-1120', fechaVencimiento: vencido },
    { id: newId('venc'), insumoId: byName['Adhesivo'], lote: 'AD-5521', fechaVencimiento: proximo },
  ];

  return {
    version: 1,
    config: {
      nombreConsultorio: 'Consultorio Odontológico',
      profesionalesSimultaneos: profSim,
      factorEsterilizacion: factorEst,
      diasAvisoVencimiento: 30,
    },
    profesionales: ['Agus', 'Dra. Martínez', 'Dr. López', 'Dra. Gómez'],
    cajones,
    insumos,
    tratamientos,
    instrumental,
    vencimientos,
    registros: [],   // registro diario
    conteos: [],     // reconciliaciones
    reposicion: [],  // lista "se está acabando"
  };
}

// --------------------------------------------------------------------
// Lógica de negocio
// --------------------------------------------------------------------
function getInsumo(id) { return db.insumos.find(i => i.id === id); }

// Alertas calculadas al vuelo
function calcularAlertas() {
  const bajoMinimo = db.insumos
    .filter(i => Number(i.stockActual) <= Number(i.stockMinimo))
    .map(i => ({ ...i, faltante: Math.max(0, Number(i.stockMinimo) * 2 - Number(i.stockActual)) }));

  const dias = db.config.diasAvisoVencimiento || 30;
  const porVencer = db.vencimientos
    .map(v => ({ ...v, insumo: getInsumo(v.insumoId), dias: diasHasta(v.fechaVencimiento) }))
    .filter(v => v.dias !== null && v.dias <= dias)
    .sort((a, b) => a.dias - b.dias); // FEFO

  const instrumentalBajo = db.instrumental
    .filter(x => Number(x.dotacionActual) < Number(x.dotacionObjetivo));

  const reposicionPendiente = db.reposicion.filter(r => !r.resuelto);

  return { bajoMinimo, porVencer, instrumentalBajo, reposicionPendiente };
}

// Registrar un tratamiento: descuenta receta (solo familia A) + extras.
function registrarTratamiento({ profesional, tratamientoId, extras }) {
  const trat = db.tratamientos.find(t => t.id === tratamientoId);
  if (!trat) throw new Error('Tratamiento no encontrado');

  const movimientos = [];
  // Descuento por receta: SOLO insumos de familia A descuentan cantidad.
  for (const item of trat.receta) {
    const ins = getInsumo(item.insumoId);
    if (!ins) continue;
    if (ins.familia === 'A') {
      ins.stockActual = Number(ins.stockActual) - Number(item.cantidad);
      movimientos.push({ insumoId: ins.id, nombre: ins.nombre, cantidad: item.cantidad });
    }
    // Familia B en receta: se registra para estadística pero NO descuenta.
  }
  // Extras fuera de receta (siempre descuentan lo indicado)
  const extrasNorm = [];
  for (const ex of (extras || [])) {
    const ins = getInsumo(ex.insumoId);
    if (!ins || !ex.cantidad) continue;
    if (ins.familia === 'A') {
      ins.stockActual = Number(ins.stockActual) - Number(ex.cantidad);
    }
    extrasNorm.push({ insumoId: ins.id, nombre: ins.nombre, cantidad: Number(ex.cantidad) });
    movimientos.push({ insumoId: ins.id, nombre: ins.nombre, cantidad: Number(ex.cantidad) });
  }

  const registro = {
    id: newId('reg'),
    fecha: hoy(),
    creado: new Date().toISOString(),
    profesional,
    tratamientoId,
    tratamientoNombre: trat.nombre,
    extras: extrasNorm,
    movimientos,
  };
  db.registros.unshift(registro);
  saveDB();
  return registro;
}

// Marcar envase vaciado (familia B): baja 1 el stock de envases.
function marcarEnvaseVaciado({ insumoId, profesional }) {
  const ins = getInsumo(insumoId);
  if (!ins) throw new Error('Insumo no encontrado');
  ins.stockActual = Number(ins.stockActual) - 1;
  db.registros.unshift({
    id: newId('reg'), fecha: hoy(), creado: new Date().toISOString(),
    profesional, tipo: 'envase_vaciado',
    tratamientoNombre: `Envase vaciado: ${ins.nombre}`,
    movimientos: [{ insumoId: ins.id, nombre: ins.nombre, cantidad: 1 }],
  });
  saveDB();
  return ins;
}

// Descartar fresa/lima: baja 1 y va a lista de reposición.
function descartarItem({ insumoId, profesional, motivo }) {
  const ins = getInsumo(insumoId);
  if (!ins) throw new Error('Insumo no encontrado');
  ins.stockActual = Number(ins.stockActual) - 1;
  const rep = agregarReposicion({
    tipo: 'descarte', refId: ins.id, texto: ins.nombre,
    motivo: motivo || 'Descartada por uso', profesional,
  });
  db.registros.unshift({
    id: newId('reg'), fecha: hoy(), creado: new Date().toISOString(),
    profesional, tipo: 'descarte',
    tratamientoNombre: `Descarte: ${ins.nombre}`,
    movimientos: [{ insumoId: ins.id, nombre: ins.nombre, cantidad: 1 }],
  });
  saveDB();
  return { insumo: ins, reposicion: rep };
}

// Reconciliación: el físico pisa al teórico. Guarda desvíos.
function registrarConteo({ persona, items }) {
  const detalle = [];
  for (const it of items) {
    const ins = getInsumo(it.insumoId);
    if (!ins) continue;
    const teorico = Number(ins.stockActual);
    const fisico = Number(it.fisico);
    if (Number.isNaN(fisico)) continue; // no contado
    detalle.push({
      insumoId: ins.id, nombre: ins.nombre, teorico, fisico, desvio: fisico - teorico,
    });
    ins.stockActual = fisico; // el conteo físico es la fuente de verdad
  }
  const conteo = {
    id: newId('cnt'), fecha: hoy(), creado: new Date().toISOString(),
    persona, detalle,
  };
  db.conteos.unshift(conteo);
  saveDB();
  return conteo;
}

function agregarReposicion({ tipo, refId, texto, motivo, profesional }) {
  const rep = {
    id: newId('rep'), fecha: hoy(), creado: new Date().toISOString(),
    tipo: tipo || 'insumo', refId: refId || null, texto,
    motivo: motivo || '', profesional: profesional || '', resuelto: false,
  };
  db.reposicion.unshift(rep);
  saveDB();
  return rep;
}

// Pedido mensual: junta todo lo que hay que pedir.
function armarPedido() {
  const a = calcularAlertas();
  const lineas = [];

  a.bajoMinimo.forEach(i => lineas.push({
    origen: 'Bajo mínimo', item: i.nombre, familia: i.familia,
    ubicacion: i.ubicacion, detalle: `Hay ${i.stockActual} ${i.unidad}, mínimo ${i.stockMinimo}`,
    sugerido: Math.max(1, Number(i.stockMinimo) * 2 - Number(i.stockActual)),
  }));

  a.instrumentalBajo.forEach(x => lineas.push({
    origen: 'Instrumental bajo objetivo', item: x.nombre, familia: 'C',
    ubicacion: 'INST-1', detalle: `Operativos ${x.dotacionActual}, objetivo ${x.dotacionObjetivo}`,
    sugerido: Number(x.dotacionObjetivo) - Number(x.dotacionActual),
  }));

  a.porVencer.filter(v => v.dias <= (db.config.diasAvisoVencimiento || 30)).forEach(v => lineas.push({
    origen: v.dias < 0 ? 'Vencido' : 'Por vencer', item: v.insumo ? v.insumo.nombre : '?',
    familia: v.insumo ? v.insumo.familia : '', ubicacion: v.insumo ? v.insumo.ubicacion : '',
    detalle: `Lote ${v.lote}, vence en ${v.dias} días`, sugerido: 1,
  }));

  a.reposicionPendiente.forEach(r => lineas.push({
    origen: 'Marcado a mano', item: r.texto, familia: '',
    ubicacion: '', detalle: r.motivo || '', sugerido: 1,
  }));

  return { fecha: hoy(), lineas };
}

// --------------------------------------------------------------------
// API HTTP
// --------------------------------------------------------------------
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 5e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  rel = decodeURIComponent(rel.split('?')[0]);
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Prohibido'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleAPI(req, res, urlPath) {
  const method = req.method;
  try {
    // --- Estado completo ---
    if (urlPath === '/api/state' && method === 'GET') {
      return sendJSON(res, 200, { ...db, alertas: calcularAlertas() });
    }
    if (urlPath === '/api/alertas' && method === 'GET') {
      return sendJSON(res, 200, calcularAlertas());
    }

    // --- Registro diario ---
    if (urlPath === '/api/registro' && method === 'POST') {
      const b = await readBody(req);
      return sendJSON(res, 200, registrarTratamiento(b));
    }
    if (urlPath === '/api/envase-vaciado' && method === 'POST') {
      const b = await readBody(req);
      return sendJSON(res, 200, marcarEnvaseVaciado(b));
    }
    if (urlPath === '/api/descarte' && method === 'POST') {
      const b = await readBody(req);
      return sendJSON(res, 200, descartarItem(b));
    }

    // --- Conteo / reconciliación ---
    if (urlPath === '/api/conteo' && method === 'POST') {
      const b = await readBody(req);
      return sendJSON(res, 200, registrarConteo(b));
    }

    // --- Reposición ---
    if (urlPath === '/api/reposicion' && method === 'POST') {
      const b = await readBody(req);
      return sendJSON(res, 200, agregarReposicion(b));
    }
    if (urlPath.startsWith('/api/reposicion/') && method === 'DELETE') {
      const id = urlPath.split('/').pop();
      db.reposicion = db.reposicion.filter(r => r.id !== id);
      saveDB();
      return sendJSON(res, 200, { ok: true });
    }
    if (urlPath.match(/^\/api\/reposicion\/.+\/resolver$/) && method === 'POST') {
      const id = urlPath.split('/')[3];
      const r = db.reposicion.find(x => x.id === id);
      if (r) { r.resuelto = true; saveDB(); }
      return sendJSON(res, 200, { ok: true });
    }

    // --- Pedido mensual ---
    if (urlPath === '/api/pedido' && method === 'GET') {
      return sendJSON(res, 200, armarPedido());
    }

    // --- Insumos (maestro) CRUD ---
    if (urlPath === '/api/insumos' && method === 'POST') {
      const b = await readBody(req);
      const nuevo = { id: newId('ins'), descartable: false, stockActual: 0, ...b };
      db.insumos.push(nuevo);
      saveDB();
      return sendJSON(res, 200, nuevo);
    }
    if (urlPath.startsWith('/api/insumos/') && method === 'PUT') {
      const id = urlPath.split('/').pop();
      const b = await readBody(req);
      const ins = getInsumo(id);
      if (!ins) return sendJSON(res, 404, { error: 'No encontrado' });
      Object.assign(ins, b, { id });
      saveDB();
      return sendJSON(res, 200, ins);
    }
    if (urlPath.startsWith('/api/insumos/') && method === 'DELETE') {
      const id = urlPath.split('/').pop();
      db.insumos = db.insumos.filter(i => i.id !== id);
      saveDB();
      return sendJSON(res, 200, { ok: true });
    }

    // --- Tratamientos / recetas ---
    if (urlPath === '/api/tratamientos' && method === 'POST') {
      const b = await readBody(req);
      const nuevo = { id: newId('trat'), nombre: b.nombre, receta: b.receta || [] };
      db.tratamientos.push(nuevo);
      saveDB();
      return sendJSON(res, 200, nuevo);
    }
    if (urlPath.startsWith('/api/tratamientos/') && method === 'PUT') {
      const id = urlPath.split('/').pop();
      const b = await readBody(req);
      const t = db.tratamientos.find(x => x.id === id);
      if (!t) return sendJSON(res, 404, { error: 'No encontrado' });
      Object.assign(t, b, { id });
      saveDB();
      return sendJSON(res, 200, t);
    }
    if (urlPath.startsWith('/api/tratamientos/') && method === 'DELETE') {
      const id = urlPath.split('/').pop();
      db.tratamientos = db.tratamientos.filter(t => t.id !== id);
      saveDB();
      return sendJSON(res, 200, { ok: true });
    }

    // --- Instrumental ---
    if (urlPath === '/api/instrumental' && method === 'POST') {
      const b = await readBody(req);
      const nuevo = { id: newId('inst'), estado: 'operativo', ...b };
      db.instrumental.push(nuevo);
      saveDB();
      return sendJSON(res, 200, nuevo);
    }
    if (urlPath.startsWith('/api/instrumental/') && method === 'PUT') {
      const id = urlPath.split('/').pop();
      const b = await readBody(req);
      const x = db.instrumental.find(i => i.id === id);
      if (!x) return sendJSON(res, 404, { error: 'No encontrado' });
      Object.assign(x, b, { id });
      saveDB();
      return sendJSON(res, 200, x);
    }
    if (urlPath.startsWith('/api/instrumental/') && method === 'DELETE') {
      const id = urlPath.split('/').pop();
      db.instrumental = db.instrumental.filter(i => i.id !== id);
      saveDB();
      return sendJSON(res, 200, { ok: true });
    }

    // --- Vencimientos ---
    if (urlPath === '/api/vencimientos' && method === 'POST') {
      const b = await readBody(req);
      const nuevo = { id: newId('venc'), ...b };
      db.vencimientos.push(nuevo);
      saveDB();
      return sendJSON(res, 200, nuevo);
    }
    if (urlPath.startsWith('/api/vencimientos/') && method === 'DELETE') {
      const id = urlPath.split('/').pop();
      db.vencimientos = db.vencimientos.filter(v => v.id !== id);
      saveDB();
      return sendJSON(res, 200, { ok: true });
    }

    // --- Config / profesionales / cajones ---
    if (urlPath === '/api/config' && method === 'PUT') {
      const b = await readBody(req);
      Object.assign(db.config, b);
      saveDB();
      return sendJSON(res, 200, db.config);
    }
    if (urlPath === '/api/profesionales' && method === 'PUT') {
      const b = await readBody(req);
      db.profesionales = b.profesionales || db.profesionales;
      saveDB();
      return sendJSON(res, 200, db.profesionales);
    }
    if (urlPath === '/api/cajones' && method === 'PUT') {
      const b = await readBody(req);
      db.cajones = b.cajones || db.cajones;
      saveDB();
      return sendJSON(res, 200, db.cajones);
    }

    return sendJSON(res, 404, { error: 'Ruta no encontrada' });
  } catch (e) {
    return sendJSON(res, 400, { error: e.message });
  }
}

// --------------------------------------------------------------------
// Arranque
// --------------------------------------------------------------------
function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

loadDB();

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (urlPath.startsWith('/api/')) return handleAPI(req, res, urlPath);
  return serveStatic(req, res, urlPath);
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLanIP();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   Sistema de Stock — Consultorio Odontológico          ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log('  ║                                                        ║');
  console.log(`  ║   En esta computadora:   http://localhost:${PORT}         ║`);
  console.log(`  ║   Desde los celulares:   http://${ip}:${PORT}   `);
  console.log('  ║   (los celulares tienen que estar en el mismo wifi)    ║');
  console.log('  ║                                                        ║');
  console.log('  ║   Para cerrar el sistema: cerrá esta ventana.          ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});
