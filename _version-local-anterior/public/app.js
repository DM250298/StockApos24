/* =====================================================================
   App — interfaz de una sola página (sin frameworks).
   Todas las vistas de las 4 fases del sistema.
   ===================================================================== */

const App = {
  state: null,
  view: 'inicio',
  usuario: localStorage.getItem('usuario') || null,
};

// ---------- Helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, method = 'GET', body) {
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch('/api' + path, opt);
  if (!r.ok) {
    let msg = 'Error';
    try { msg = (await r.json()).error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return r.json();
}

async function loadState() {
  App.state = await api('/state');
  return App.state;
}

function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + kind;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

function insumoById(id) { return App.state.insumos.find(i => i.id === id); }
function familiaBadge(f) {
  const nom = { A: 'Discreto', B: 'Granel', C: 'Instrumental' }[f] || f;
  return `<span class="badge badge-${f}">${f} · ${nom}</span>`;
}

// ---------- Modal ----------
function openModal(html) {
  $('#modal').innerHTML = html;
  $('#modalOverlay').hidden = false;
}
function closeModal() { $('#modalOverlay').hidden = true; }
$('#modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

// ---------- Identificación (elegir quién soy) ----------
function elegirUsuario(forzar) {
  const profs = App.state.profesionales;
  const opciones = profs.map(p => `<button class="btn btn-block" style="margin-bottom:8px" onclick="setUsuario('${esc(p)}')">${esc(p)}</button>`).join('');
  openModal(`
    <h3 class="modal-title">¿Quién sos?</h3>
    <p class="muted small">Elegí tu nombre. No hace falta contraseña.</p>
    <div class="mt">${opciones}</div>
    ${forzar ? '' : '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div>'}
  `);
}
function setUsuario(nombre) {
  App.usuario = nombre;
  localStorage.setItem('usuario', nombre);
  $('#whoamiName').textContent = nombre;
  closeModal();
}
$('#whoamiBtn').addEventListener('click', () => elegirUsuario(false));

// ---------- Navegación ----------
function go(view) {
  App.view = view;
  if (view === 'pedido') App._pedido = null; // recalcular siempre al entrar
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  render();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => go(t.dataset.view));
});

// =====================================================================
// RENDER principal
// =====================================================================
function render() {
  const v = $('#view');
  const map = {
    inicio: viewInicio,
    registro: viewRegistro,
    conteo: viewConteo,
    pedido: viewPedido,
    mas: viewMas,
    insumos: viewInsumos,
    tratamientos: viewTratamientos,
    instrumental: viewInstrumental,
    vencimientos: viewVencimientos,
    reposicion: viewReposicion,
    carteles: viewCarteles,
    config: viewConfig,
  };
  v.innerHTML = (map[App.view] || viewInicio)();
  if (App['after_' + App.view]) App['after_' + App.view]();
}

// =====================================================================
// FASE 3 — INICIO / Tablero de alertas
// =====================================================================
function viewInicio() {
  const a = App.state.alertas;
  const nRojo = a.bajoMinimo.length;
  const nVence = a.porVencer.length;
  const nInst = a.instrumentalBajo.length;
  const nRep = a.reposicionPendiente.length;

  const alertaHtml = (items, render, vacio) => items.length
    ? items.map(render).join('')
    : `<p class="muted small center" style="padding:12px">${vacio}</p>`;

  return `
    <h1 class="view-title">Hola${App.usuario ? ', ' + esc(App.usuario) : ''} 👋</h1>
    <p class="view-sub">Esto es lo que necesita atención hoy.</p>

    <div class="tiles">
      <div class="tile ${nRojo ? 'tile-rojo' : 'tile-verde'}"><div class="n">${nRojo}</div><div class="l">Bajo mínimo</div></div>
      <div class="tile ${nVence ? 'tile-amarillo' : 'tile-verde'}"><div class="n">${nVence}</div><div class="l">Por vencer / vencidos</div></div>
      <div class="tile ${nInst ? 'tile-rojo' : 'tile-verde'}"><div class="n">${nInst}</div><div class="l">Instrumental corto</div></div>
      <div class="tile tile-teal"><div class="n">${nRep}</div><div class="l">En lista de reposición</div></div>
    </div>

    <button class="btn btn-primary btn-block btn-lg mt" onclick="go('pedido')">🛒 Armar el pedido del mes</button>

    <div class="section-title">🔴 Bajo mínimo</div>
    <div class="card">${alertaHtml(a.bajoMinimo, i => `
      <div class="alert-item stripe-rojo">
        <div><div class="nom">${esc(i.nombre)}</div><div class="meta">${familiaBadge(i.familia)} · 📍 ${esc(i.ubicacion || '—')}</div></div>
        <div class="right"><span class="badge badge-rojo">${i.stockActual} / mín ${i.stockMinimo}</span></div>
      </div>`, '✅ Todo por encima del mínimo.')}
    </div>

    <div class="section-title">🟡 Vencimientos (FEFO)</div>
    <div class="card">${alertaHtml(a.porVencer, v => {
      const vencido = v.dias < 0;
      return `<div class="alert-item ${vencido ? 'stripe-rojo' : 'stripe-amarillo'}">
        <div><div class="nom">${esc(v.insumo ? v.insumo.nombre : '?')}</div><div class="meta">Lote ${esc(v.lote)} · 📍 ${esc(v.insumo ? v.insumo.ubicacion : '')}</div></div>
        <div class="right"><span class="badge ${vencido ? 'badge-rojo' : 'badge-amarillo'}">${vencido ? 'VENCIDO' : 'vence en ' + v.dias + ' d'}</span></div>
      </div>`;
    }, '✅ Nada por vencer pronto.')}
    </div>

    <div class="section-title">🦾 Instrumental bajo objetivo</div>
    <div class="card">${alertaHtml(a.instrumentalBajo, x => `
      <div class="alert-item stripe-rojo">
        <div><div class="nom">${esc(x.nombre)}</div><div class="meta">Se pide ya: quedaste corta para atender en simultáneo</div></div>
        <div class="right"><span class="badge badge-rojo">${x.dotacionActual} / obj ${x.dotacionObjetivo}</span></div>
      </div>`, '✅ Dotación completa.')}
    </div>
  `;
}

// =====================================================================
// FASE 2 — REGISTRO DIARIO (receta de cocina)
// =====================================================================
function viewRegistro() {
  const trats = App.state.tratamientos;
  const granel = App.state.insumos.filter(i => i.familia === 'B');
  const descartables = App.state.insumos.filter(i => i.descartable);

  return `
    <h1 class="view-title">Registrar</h1>
    <p class="view-sub">Al terminar el día: elegí el tratamiento y el sistema descuenta solo.</p>

    <div class="section-title">Tratamiento que hice</div>
    <div class="treat-grid">
      ${trats.map(t => `<button class="treat-btn" onclick="abrirRegistro('${t.id}')">${esc(t.nombre)}</button>`).join('')}
      ${trats.length === 0 ? '<p class="muted">No hay tratamientos cargados todavía.</p>' : ''}
    </div>

    <div class="section-title">Marcar envase vaciado (granel)</div>
    <p class="muted small" style="margin-top:-4px">Cuando terminás un frasco/jeringa, marcalo acá. Baja 1 del stock.</p>
    <div class="chips">
      ${granel.map(i => `<button class="chip" onclick="marcarEnvase('${i.id}')">${esc(i.nombre)} <span class="muted">(${i.stockActual})</span></button>`).join('')}
    </div>

    <div class="section-title">Descartar fresa / lima</div>
    <p class="muted small" style="margin-top:-4px">Se descarta por desgaste o fractura. Baja 1 y va a la lista de reposición.</p>
    <div class="chips">
      ${descartables.map(i => `<button class="chip" onclick="descartar('${i.id}')">${esc(i.nombre)} <span class="muted">(${i.stockActual})</span></button>`).join('')}
    </div>
  `;
}

function abrirRegistro(tratId) {
  if (!App.usuario) return elegirUsuario(true);
  const trat = App.state.tratamientos.find(t => t.id === tratId);
  const recetaA = trat.receta.map(r => ({ ...r, ins: insumoById(r.insumoId) }))
    .filter(r => r.ins);
  const listaReceta = recetaA.map(r => `
    <div class="alert-item">
      <div><span class="nom">${esc(r.ins.nombre)}</span> ${r.ins.familia !== 'A' ? '<span class="badge badge-B">solo estadística</span>' : ''}</div>
      <div class="right muted">${r.ins.familia === 'A' ? '−' + r.cantidad + ' ' + esc(r.ins.unidad) : 'no descuenta'}</div>
    </div>`).join('');

  // Insumos disponibles para agregar como extra (familia A)
  const extrasOpts = App.state.insumos.filter(i => i.familia === 'A')
    .map(i => `<option value="${i.id}">${esc(i.nombre)}</option>`).join('');

  openModal(`
    <h3 class="modal-title">${esc(trat.nombre)}</h3>
    <p class="muted small">Se va a descontar automáticamente:</p>
    <div class="card" style="box-shadow:none">${listaReceta || '<p class="muted small">Sin receta.</p>'}</div>

    <div class="field">
      <label>¿Usaste algo fuera de la receta? (opcional)</label>
      <div id="extrasList"></div>
      <div class="field-row" style="margin-top:8px">
        <select id="extraSel"><option value="">Agregar insumo…</option>${extrasOpts}</select>
        <input id="extraCant" type="number" min="1" value="1" style="max-width:80px">
        <button class="btn btn-ghost btn-sm" onclick="addExtra()">Agregar</button>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarRegistro('${tratId}')">✓ Registrar</button>
    </div>
  `);
  App._extras = [];
}

App._extras = [];
function addExtra() {
  const sel = $('#extraSel'); const cant = $('#extraCant');
  if (!sel.value) return;
  App._extras.push({ insumoId: sel.value, cantidad: Number(cant.value) || 1 });
  sel.value = ''; cant.value = 1;
  renderExtras();
}
function renderExtras() {
  const el = $('#extrasList');
  if (!el) return;
  el.innerHTML = App._extras.map((e, idx) => {
    const ins = insumoById(e.insumoId);
    return `<div class="alert-item"><span class="nom">${esc(ins ? ins.nombre : '?')}</span>
      <div class="right"><span class="muted">−${e.cantidad}</span>
      <button class="btn btn-sm btn-danger" onclick="delExtra(${idx})" style="margin-left:8px">Quitar</button></div></div>`;
  }).join('');
}
function delExtra(idx) { App._extras.splice(idx, 1); renderExtras(); }

async function confirmarRegistro(tratId) {
  try {
    await api('/registro', 'POST', { profesional: App.usuario, tratamientoId: tratId, extras: App._extras });
    App._extras = [];
    closeModal();
    await loadState();
    toast('Tratamiento registrado ✓');
    render();
  } catch (e) { toast(e.message, 'err'); }
}

async function marcarEnvase(insumoId) {
  if (!App.usuario) return elegirUsuario(true);
  const ins = insumoById(insumoId);
  if (!confirm(`¿Marcar un envase de "${ins.nombre}" como vaciado? Baja 1 del stock.`)) return;
  try {
    await api('/envase-vaciado', 'POST', { insumoId, profesional: App.usuario });
    await loadState(); toast('Envase vaciado ✓'); render();
  } catch (e) { toast(e.message, 'err'); }
}

async function descartar(insumoId) {
  if (!App.usuario) return elegirUsuario(true);
  const ins = insumoById(insumoId);
  if (!confirm(`¿Descartar una "${ins.nombre}"? Baja 1 y va a la lista de reposición.`)) return;
  try {
    await api('/descarte', 'POST', { insumoId, profesional: App.usuario, motivo: 'Descartada por uso' });
    await loadState(); toast('Descartada y anotada para reponer ✓'); render();
  } catch (e) { toast(e.message, 'err'); }
}

// =====================================================================
// FASE 3 — CONTEO / RECONCILIACIÓN (guiado por cajón)
// =====================================================================
function viewConteo() {
  // Agrupar insumos por cajón (ubicación)
  const porCajon = {};
  App.state.insumos.forEach(i => {
    const c = i.ubicacion || 'Sin ubicación';
    (porCajon[c] = porCajon[c] || []).push(i);
  });
  const cajonNombre = {};
  App.state.cajones.forEach(c => { cajonNombre[c.codigo] = c.descripcion; });

  const secciones = Object.keys(porCajon).sort().map(cod => `
    <div class="section-title">📦 ${esc(cod)} ${cajonNombre[cod] ? '· ' + esc(cajonNombre[cod]) : ''}</div>
    <div class="card">
      ${porCajon[cod].map(i => `
        <div class="alert-item">
          <div>
            <div class="nom">${esc(i.nombre)}</div>
            <div class="meta">Sistema dice: <b>${i.stockActual}</b> ${esc(i.unidad)} · ${familiaBadge(i.familia)}</div>
          </div>
          <div class="counter">
            <input type="number" inputmode="numeric" data-count="${i.id}" placeholder="${i.stockActual}" style="width:80px">
          </div>
        </div>`).join('')}
    </div>
  `).join('');

  const ultimo = App.state.conteos[0];

  return `
    <h1 class="view-title">Conteo</h1>
    <p class="view-sub">Recorré cajón por cajón y anotá cuánto hay <b>de verdad</b>. Lo que dejes vacío no se toca.</p>
    ${ultimo ? `<p class="muted small">Último conteo: ${esc(ultimo.fecha)} por ${esc(ultimo.persona || '—')}.</p>` : ''}
    ${secciones || '<p class="empty">No hay insumos cargados.</p>'}
    <button class="btn btn-primary btn-block btn-lg mt" onclick="guardarConteo()">✓ Guardar conteo y reconciliar</button>
    <div class="spacer"></div>
  `;
}

async function guardarConteo() {
  if (!App.usuario) return elegirUsuario(true);
  const inputs = document.querySelectorAll('[data-count]');
  const items = [];
  inputs.forEach(inp => {
    if (inp.value !== '') items.push({ insumoId: inp.dataset.count, fisico: Number(inp.value) });
  });
  if (items.length === 0) return toast('No anotaste ninguna cantidad.', 'err');

  // Mostrar desvíos antes de confirmar
  const filas = items.map(it => {
    const ins = insumoById(it.insumoId);
    const desvio = it.fisico - Number(ins.stockActual);
    const cls = desvio === 0 ? 'badge-verde' : (desvio < 0 ? 'badge-rojo' : 'badge-amarillo');
    return `<tr><td>${esc(ins.nombre)}</td><td class="right">${ins.stockActual}</td><td class="right">${it.fisico}</td>
      <td class="right"><span class="badge ${cls}">${desvio > 0 ? '+' : ''}${desvio}</span></td></tr>`;
  }).join('');

  openModal(`
    <h3 class="modal-title">Revisá el desvío</h3>
    <p class="muted small">El número físico va a pisar al del sistema. Los desvíos te muestran consumo real, roturas o cargas olvidadas.</p>
    <div class="tbl-wrap mt"><table>
      <thead><tr><th>Insumo</th><th class="right">Sistema</th><th class="right">Físico</th><th class="right">Desvío</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Volver</button>
      <button class="btn btn-primary" onclick='confirmarConteo(${JSON.stringify(items)})'>✓ Confirmar</button>
    </div>
  `);
}

async function confirmarConteo(items) {
  try {
    await api('/conteo', 'POST', { persona: App.usuario, items });
    closeModal();
    await loadState();
    toast('Conteo guardado y stock reconciliado ✓');
    go('inicio');
  } catch (e) { toast(e.message, 'err'); }
}

// =====================================================================
// FASE 4 — PEDIDO MENSUAL
// =====================================================================
async function viewPedido_load() {
  const pedido = await api('/pedido');
  App._pedido = pedido;
  render();
}
function viewPedido() {
  if (!App._pedido) { setTimeout(viewPedido_load, 0); return '<div class="empty"><div class="big">🛒</div>Armando el pedido…</div>'; }
  const p = App._pedido;
  const colores = { 'Bajo mínimo': 'badge-rojo', 'Vencido': 'badge-rojo', 'Por vencer': 'badge-amarillo', 'Instrumental bajo objetivo': 'badge-C', 'Marcado a mano': 'badge-gris' };
  const filas = p.lineas.map(l => `
    <tr>
      <td><span class="badge ${colores[l.origen] || 'badge-gris'}">${esc(l.origen)}</span></td>
      <td><b>${esc(l.item)}</b></td>
      <td class="right">${l.sugerido}</td>
      <td class="muted">${esc(l.detalle)}</td>
      <td>${esc(l.ubicacion || '')}</td>
    </tr>`).join('');

  return `
    <h1 class="view-title no-print">Pedido del mes</h1>
    <p class="view-sub no-print">Junta lo bajo mínimo + instrumental corto + lo que vence + lo marcado a mano. Se lo pasás a la clínica.</p>
    <div class="card no-print" style="display:flex;gap:10px">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
      <button class="btn btn-ghost" onclick="copiarPedido()">📋 Copiar como texto</button>
      <button class="btn btn-ghost" onclick="App._pedido=null;render()">🔄 Recalcular</button>
    </div>
    <h2 style="margin:16px 0 4px">Pedido — ${esc(p.fecha)}</h2>
    ${p.lineas.length === 0 ? '<p class="empty">✅ No hay nada para pedir. Todo en orden.</p>' : `
    <div class="tbl-wrap"><table>
      <thead><tr><th>Motivo</th><th>Ítem</th><th class="right">Sugerido</th><th>Detalle</th><th>Cajón</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>`}
  `;
}
function copiarPedido() {
  const p = App._pedido;
  const txt = `PEDIDO ${p.fecha}\n` + p.lineas.map(l => `• ${l.item} (x${l.sugerido}) — ${l.origen}${l.detalle ? ': ' + l.detalle : ''}`).join('\n');
  navigator.clipboard.writeText(txt).then(() => toast('Pedido copiado ✓')).catch(() => toast('No se pudo copiar', 'err'));
}

// =====================================================================
// MENÚ "MÁS"
// =====================================================================
function viewMas() {
  const item = (view, ico, tit, desc) => `
    <div class="menu-item" onclick="go('${view}')">
      <span class="ico">${ico}</span>
      <div><div>${tit}</div><div class="desc">${desc}</div></div>
    </div>`;
  return `
    <h1 class="view-title">Más</h1>
    <div class="menu-list">
      ${item('insumos', '📚', 'Insumos (maestro)', 'Lista de todo, familia, ubicación y mínimo')}
      ${item('tratamientos', '🍳', 'Tratamientos y recetas', 'Qué descuenta cada tratamiento')}
      ${item('instrumental', '🦾', 'Instrumental', 'Dotación actual vs. objetivo, roturas')}
      ${item('vencimientos', '📅', 'Vencimientos', 'Lotes y fechas (FEFO)')}
      ${item('reposicion', '📝', 'Lista de reposición', 'Lo que se está acabando entre conteos')}
      ${item('carteles', '🏷️', 'Carteles y mapa de cajones', 'Imprimir lo que va en cada cajón')}
      ${item('config', '⚙️', 'Configuración', 'Profesionales, factor de esterilización')}
    </div>
    <p class="muted small center mt">Sistema de stock · datos guardados en esta computadora con backup automático.</p>
  `;
}

// =====================================================================
// FASE 1 — INSUMOS (maestro)
// =====================================================================
function viewInsumos() {
  const filas = App.state.insumos.map(i => `
    <tr class="${Number(i.stockActual) <= Number(i.stockMinimo) ? 'row-rojo' : ''}">
      <td><b>${esc(i.nombre)}</b></td>
      <td>${familiaBadge(i.familia)}</td>
      <td>${esc(i.categoria || '')}</td>
      <td class="right">${i.stockActual}</td>
      <td>${esc(i.unidad)}</td>
      <td class="right">${i.stockMinimo}</td>
      <td>${esc(i.ubicacion || '')}</td>
      <td>${i.vence ? '📅' : ''}</td>
      <td class="nowrap">
        <button class="btn btn-sm btn-ghost" onclick="editarInsumo('${i.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="borrarInsumo('${i.id}')">🗑️</button>
      </td>
    </tr>`).join('');
  return `
    <div class="card-row"><h1 class="view-title" style="margin:0">Insumos</h1>
      <button class="btn btn-primary btn-sm" onclick="editarInsumo()">＋ Nuevo</button></div>
    <p class="view-sub">El maestro: cuánto hay, dónde está y cuándo se pide. Buscá acá cuando algo no aparece.</p>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Nombre</th><th>Familia</th><th>Categoría</th><th class="right">Stock</th><th>Unidad</th><th class="right">Mín</th><th>Cajón</th><th>Vence</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
  `;
}

function editarInsumo(id) {
  const i = id ? insumoById(id) : { familia: 'A', vence: false, descartable: false, stockActual: 0, stockMinimo: 0 };
  const cajonesOpts = App.state.cajones.map(c => `<option value="${c.codigo}" ${i.ubicacion === c.codigo ? 'selected' : ''}>${c.codigo} · ${esc(c.descripcion)}</option>`).join('');
  openModal(`
    <h3 class="modal-title">${id ? 'Editar' : 'Nuevo'} insumo</h3>
    <div class="field"><label>Nombre</label><input id="f_nombre" value="${esc(i.nombre || '')}"></div>
    <div class="field-row">
      <div class="field"><label>Familia</label><select id="f_familia">
        <option value="A" ${i.familia === 'A' ? 'selected' : ''}>A · Discreto</option>
        <option value="B" ${i.familia === 'B' ? 'selected' : ''}>B · Granel (por envase)</option>
      </select></div>
      <div class="field"><label>Unidad</label><input id="f_unidad" value="${esc(i.unidad || 'unidad')}" placeholder="caja, jeringa…"></div>
    </div>
    <div class="field"><label>Categoría</label><input id="f_categoria" value="${esc(i.categoria || '')}"></div>
    <div class="field-row">
      <div class="field"><label>Stock actual</label><input id="f_stock" type="number" value="${i.stockActual}"></div>
      <div class="field"><label>Stock mínimo</label><input id="f_min" type="number" value="${i.stockMinimo}"></div>
    </div>
    <div class="field"><label>Ubicación (cajón)</label><select id="f_ubic"><option value="">— Sin ubicación —</option>${cajonesOpts}</select></div>
    <div class="field-row">
      <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="f_vence" style="width:auto" ${i.vence ? 'checked' : ''}> ¿Vence?</label>
      <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="f_desc" style="width:auto" ${i.descartable ? 'checked' : ''}> ¿Fresa/lima descartable?</label>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarInsumo(${id ? "'" + id + "'" : 'null'})">Guardar</button>
    </div>
  `);
}
async function guardarInsumo(id) {
  const body = {
    nombre: $('#f_nombre').value.trim(),
    familia: $('#f_familia').value,
    unidad: $('#f_unidad').value.trim() || 'unidad',
    categoria: $('#f_categoria').value.trim(),
    stockActual: Number($('#f_stock').value) || 0,
    stockMinimo: Number($('#f_min').value) || 0,
    ubicacion: $('#f_ubic').value,
    vence: $('#f_vence').checked,
    descartable: $('#f_desc').checked,
  };
  if (!body.nombre) return toast('Poné un nombre.', 'err');
  try {
    if (id) await api('/insumos/' + id, 'PUT', body);
    else await api('/insumos', 'POST', body);
    closeModal(); await loadState(); toast('Guardado ✓'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function borrarInsumo(id) {
  const i = insumoById(id);
  if (!confirm(`¿Borrar "${i.nombre}" del maestro?`)) return;
  try { await api('/insumos/' + id, 'DELETE'); await loadState(); toast('Borrado ✓'); render(); }
  catch (e) { toast(e.message, 'err'); }
}

// =====================================================================
// FASE 2 — TRATAMIENTOS y RECETAS
// =====================================================================
function viewTratamientos() {
  const trats = App.state.tratamientos.map(t => {
    const receta = t.receta.map(r => {
      const ins = insumoById(r.insumoId);
      return ins ? `${esc(ins.nombre)} ×${r.cantidad}` : '';
    }).filter(Boolean).join(' · ');
    return `<div class="card">
      <div class="card-row">
        <b>${esc(t.nombre)}</b>
        <div class="nowrap">
          <button class="btn btn-sm btn-ghost" onclick="editarTratamiento('${t.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="borrarTratamiento('${t.id}')">🗑️</button>
        </div>
      </div>
      <div class="muted small mt">${receta || 'Sin receta'}</div>
    </div>`;
  }).join('');
  return `
    <div class="card-row"><h1 class="view-title" style="margin:0">Tratamientos</h1>
      <button class="btn btn-primary btn-sm" onclick="editarTratamiento()">＋ Nuevo</button></div>
    <p class="view-sub">La "receta de cocina": qué insumos discretos descuenta cada tratamiento. Se ajustan con los primeros conteos.</p>
    ${trats || '<p class="empty">No hay tratamientos.</p>'}
  `;
}
function editarTratamiento(id) {
  const t = id ? App.state.tratamientos.find(x => x.id === id) : { nombre: '', receta: [] };
  App._receta = JSON.parse(JSON.stringify(t.receta));
  const opts = App.state.insumos.filter(i => i.familia === 'A')
    .map(i => `<option value="${i.id}">${esc(i.nombre)}</option>`).join('');
  openModal(`
    <h3 class="modal-title">${id ? 'Editar' : 'Nuevo'} tratamiento</h3>
    <div class="field"><label>Nombre</label><input id="t_nombre" value="${esc(t.nombre)}"></div>
    <label class="small" style="font-weight:600">Receta (solo insumos discretos / familia A)</label>
    <div id="recetaList" class="mt"></div>
    <div class="field-row" style="margin-top:8px">
      <select id="r_ins"><option value="">Agregar insumo…</option>${opts}</select>
      <input id="r_cant" type="number" min="1" value="1" style="max-width:80px">
      <button class="btn btn-ghost btn-sm" onclick="addReceta()">Agregar</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarTratamiento(${id ? "'" + id + "'" : 'null'})">Guardar</button>
    </div>
  `);
  renderReceta();
}
function renderReceta() {
  const el = $('#recetaList');
  el.innerHTML = App._receta.map((r, idx) => {
    const ins = insumoById(r.insumoId);
    return `<div class="alert-item"><span class="nom">${esc(ins ? ins.nombre : '?')}</span>
      <div class="right"><span class="muted">×${r.cantidad}</span>
      <button class="btn btn-sm btn-danger" onclick="delReceta(${idx})" style="margin-left:8px">Quitar</button></div></div>`;
  }).join('') || '<p class="muted small">Todavía sin insumos.</p>';
}
function addReceta() {
  const sel = $('#r_ins'); const cant = $('#r_cant');
  if (!sel.value) return;
  App._receta.push({ insumoId: sel.value, cantidad: Number(cant.value) || 1 });
  sel.value = ''; cant.value = 1; renderReceta();
}
function delReceta(idx) { App._receta.splice(idx, 1); renderReceta(); }
async function guardarTratamiento(id) {
  const body = { nombre: $('#t_nombre').value.trim(), receta: App._receta };
  if (!body.nombre) return toast('Poné un nombre.', 'err');
  try {
    if (id) await api('/tratamientos/' + id, 'PUT', body);
    else await api('/tratamientos', 'POST', body);
    closeModal(); await loadState(); toast('Guardado ✓'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function borrarTratamiento(id) {
  if (!confirm('¿Borrar este tratamiento?')) return;
  try { await api('/tratamientos/' + id, 'DELETE'); await loadState(); toast('Borrado ✓'); render(); }
  catch (e) { toast(e.message, 'err'); }
}

// =====================================================================
// FASE 4 — INSTRUMENTAL (dotación objetivo)
// =====================================================================
function viewInstrumental() {
  const filas = App.state.instrumental.map(x => {
    const corto = Number(x.dotacionActual) < Number(x.dotacionObjetivo);
    return `<tr class="${corto ? 'row-rojo' : ''}">
      <td><b>${esc(x.nombre)}</b></td>
      <td class="right">${x.dotacionActual}</td>
      <td class="right">${x.dotacionObjetivo}</td>
      <td>${corto ? '<span class="badge badge-rojo">Pedir ya</span>' : '<span class="badge badge-verde">OK</span>'}</td>
      <td class="nowrap">
        <button class="btn btn-sm btn-danger" onclick="romperInstrumental('${x.id}')">💥 Rotura</button>
        <button class="btn btn-sm btn-ghost" onclick="editarInstrumental('${x.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="borrarInstrumental('${x.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
  const cfg = App.state.config;
  return `
    <div class="card-row"><h1 class="view-title" style="margin:0">Instrumental</h1>
      <button class="btn btn-primary btn-sm" onclick="editarInstrumental()">＋ Nuevo</button></div>
    <p class="view-sub">Objetivo = ${cfg.profesionalesSimultaneos} en simultáneo × ${cfg.factorEsterilizacion} (esterilización) = <b>${cfg.profesionalesSimultaneos * cfg.factorEsterilizacion}</b>. Si caés por debajo, se pide ya.</p>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Instrumento</th><th class="right">Operativos</th><th class="right">Objetivo</th><th>Estado</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
  `;
}
async function romperInstrumental(id) {
  const x = App.state.instrumental.find(i => i.id === id);
  if (!confirm(`¿Se rompió/perdió un "${x.nombre}"? Baja 1 la dotación operativa.`)) return;
  try {
    await api('/instrumental/' + id, 'PUT', { dotacionActual: Math.max(0, Number(x.dotacionActual) - 1) });
    await api('/reposicion', 'POST', { tipo: 'instrumental', refId: id, texto: x.nombre, motivo: 'Rotura/pérdida', profesional: App.usuario || '' });
    await loadState(); toast('Rotura registrada ✓'); render();
  } catch (e) { toast(e.message, 'err'); }
}
function editarInstrumental(id) {
  const x = id ? App.state.instrumental.find(i => i.id === id) : { nombre: '', dotacionActual: 0, dotacionObjetivo: App.state.config.profesionalesSimultaneos * App.state.config.factorEsterilizacion, estado: 'operativo' };
  openModal(`
    <h3 class="modal-title">${id ? 'Editar' : 'Nuevo'} instrumento</h3>
    <div class="field"><label>Nombre</label><input id="i_nombre" value="${esc(x.nombre)}"></div>
    <div class="field-row">
      <div class="field"><label>Operativos ahora</label><input id="i_act" type="number" value="${x.dotacionActual}"></div>
      <div class="field"><label>Dotación objetivo</label><input id="i_obj" type="number" value="${x.dotacionObjetivo}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarInstrumental(${id ? "'" + id + "'" : 'null'})">Guardar</button>
    </div>
  `);
}
async function guardarInstrumental(id) {
  const body = { nombre: $('#i_nombre').value.trim(), dotacionActual: Number($('#i_act').value) || 0, dotacionObjetivo: Number($('#i_obj').value) || 0 };
  if (!body.nombre) return toast('Poné un nombre.', 'err');
  try {
    if (id) await api('/instrumental/' + id, 'PUT', body);
    else await api('/instrumental', 'POST', body);
    closeModal(); await loadState(); toast('Guardado ✓'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function borrarInstrumental(id) {
  if (!confirm('¿Borrar este instrumento?')) return;
  try { await api('/instrumental/' + id, 'DELETE'); await loadState(); toast('Borrado ✓'); render(); }
  catch (e) { toast(e.message, 'err'); }
}

// =====================================================================
// FASE 3 — VENCIMIENTOS (FEFO)
// =====================================================================
function viewVencimientos() {
  const items = App.state.vencimientos.map(v => ({ ...v, ins: insumoById(v.insumoId), dias: diasHasta(v.fechaVencimiento) }))
    .sort((a, b) => (a.dias == null ? 1 : b.dias == null ? -1 : a.dias - b.dias));
  const dias = App.state.config.diasAvisoVencimiento || 30;
  const filas = items.map(v => {
    const cls = v.dias < 0 ? 'row-rojo' : (v.dias <= dias ? 'row-amarillo' : '');
    return `<tr class="${cls}">
      <td><b>${esc(v.ins ? v.ins.nombre : '?')}</b></td>
      <td>${esc(v.lote)}</td>
      <td>${esc(v.fechaVencimiento)}</td>
      <td class="right">${v.dias == null ? '—' : (v.dias < 0 ? '<span class="badge badge-rojo">VENCIDO</span>' : v.dias + ' d')}</td>
      <td>${esc(v.ins ? v.ins.ubicacion : '')}</td>
      <td><button class="btn btn-sm btn-danger" onclick="borrarVenc('${v.id}')">🗑️</button></td>
    </tr>`;
  }).join('');
  return `
    <div class="card-row"><h1 class="view-title" style="margin:0">Vencimientos</h1>
      <button class="btn btn-primary btn-sm" onclick="nuevoVenc()">＋ Lote</button></div>
    <p class="view-sub">FEFO: se usa primero lo que vence antes. Ordenado de más urgente a menos.</p>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Insumo</th><th>Lote</th><th>Vence</th><th class="right">Faltan</th><th>Cajón</th><th></th></tr></thead>
      <tbody>${filas || ''}</tbody>
    </table></div>
    ${items.length === 0 ? '<p class="empty">No hay lotes cargados.</p>' : ''}
  `;
}
function diasHasta(fechaISO) {
  if (!fechaISO) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const obj = new Date(fechaISO);
  return Math.round((obj - hoy) / 86400000);
}
function nuevoVenc() {
  const opts = App.state.insumos.filter(i => i.vence).map(i => `<option value="${i.id}">${esc(i.nombre)}</option>`).join('');
  openModal(`
    <h3 class="modal-title">Nuevo lote</h3>
    <div class="field"><label>Insumo</label><select id="v_ins">${opts}</select></div>
    <div class="field-row">
      <div class="field"><label>Lote</label><input id="v_lote" placeholder="L-2025-A"></div>
      <div class="field"><label>Fecha de vencimiento</label><input id="v_fecha" type="date"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarVenc()">Guardar</button>
    </div>
  `);
}
async function guardarVenc() {
  const body = { insumoId: $('#v_ins').value, lote: $('#v_lote').value.trim(), fechaVencimiento: $('#v_fecha').value };
  if (!body.insumoId || !body.fechaVencimiento) return toast('Completá insumo y fecha.', 'err');
  try { await api('/vencimientos', 'POST', body); closeModal(); await loadState(); toast('Lote guardado ✓'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
async function borrarVenc(id) {
  if (!confirm('¿Borrar este lote?')) return;
  try { await api('/vencimientos/' + id, 'DELETE'); await loadState(); toast('Borrado ✓'); render(); }
  catch (e) { toast(e.message, 'err'); }
}

// =====================================================================
// FASE 4 — LISTA DE REPOSICIÓN
// =====================================================================
function viewReposicion() {
  const items = App.state.reposicion.filter(r => !r.resuelto);
  const filas = items.map(r => `
    <div class="card">
      <div class="card-row">
        <div><b>${esc(r.texto)}</b> <span class="badge badge-gris">${esc(r.tipo)}</span>
          <div class="muted small">${esc(r.motivo || '')}${r.profesional ? ' · ' + esc(r.profesional) : ''} · ${esc(r.fecha)}</div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="resolverRep('${r.id}')">✓ Listo</button>
      </div>
    </div>`).join('');
  return `
    <div class="card-row"><h1 class="view-title" style="margin:0">Reposición</h1>
      <button class="btn btn-primary btn-sm" onclick="nuevaRep()">＋ Anotar</button></div>
    <p class="view-sub">Reemplaza el papelito: cualquiera anota lo que se está acabando entre conteos. Entra al pedido del mes.</p>
    ${filas || '<p class="empty"><div class="big">📝</div>Nada anotado. Todo bajo control.</p>'}
  `;
}
function nuevaRep() {
  openModal(`
    <h3 class="modal-title">Anotar para reponer</h3>
    <div class="field"><label>¿Qué falta?</label><input id="rep_txt" placeholder="Ej: se están acabando las agujas largas"></div>
    <div class="field"><label>Nota (opcional)</label><input id="rep_motivo" placeholder="motivo / cantidad"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarRep()">Anotar</button>
    </div>
  `);
}
async function guardarRep() {
  const texto = $('#rep_txt').value.trim();
  if (!texto) return toast('Escribí qué falta.', 'err');
  try {
    await api('/reposicion', 'POST', { tipo: 'manual', texto, motivo: $('#rep_motivo').value.trim(), profesional: App.usuario || '' });
    closeModal(); await loadState(); toast('Anotado ✓'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function resolverRep(id) {
  try { await api('/reposicion/' + id + '/resolver', 'POST'); await loadState(); toast('Marcado como resuelto ✓'); render(); }
  catch (e) { toast(e.message, 'err'); }
}

// =====================================================================
// FASE 1 — CARTELES Y MAPA DE CAJONES
// =====================================================================
function viewCarteles() {
  const porCajon = {};
  App.state.insumos.forEach(i => {
    const c = i.ubicacion || 'Sin ubicación';
    (porCajon[c] = porCajon[c] || []).push(i.nombre);
  });
  const cajonNombre = {};
  App.state.cajones.forEach(c => { cajonNombre[c.codigo] = c.descripcion; });

  const carteles = Object.keys(porCajon).sort().map(cod => `
    <div class="cartel">
      <h2>${esc(cod)}</h2>
      <div class="codigo">${esc(cajonNombre[cod] || '')}</div>
      <ul>${porCajon[cod].sort().map(n => `<li>${esc(n)}</li>`).join('')}</ul>
    </div>`).join('');

  return `
    <h1 class="view-title no-print">Carteles de cajones</h1>
    <p class="view-sub no-print">Cada cartel dice <b>qué va en ese cajón</b>, sin cantidades (así casi no envejece). Imprimí y pegá adentro de cada cajón.</p>
    <div class="card no-print"><button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir carteles (uno por hoja)</button></div>
    ${carteles || '<p class="empty">No hay insumos con ubicación.</p>'}
  `;
}

// =====================================================================
// CONFIGURACIÓN
// =====================================================================
function viewConfig() {
  const c = App.state.config;
  return `
    <h1 class="view-title">Configuración</h1>
    <div class="card">
      <div class="field"><label>Nombre del consultorio</label><input id="c_nombre" value="${esc(c.nombreConsultorio || '')}"></div>
      <div class="field-row">
        <div class="field"><label>Profesionales en simultáneo</label><input id="c_prof" type="number" value="${c.profesionalesSimultaneos}"></div>
        <div class="field"><label>Factor de esterilización (2× o 3×)</label><input id="c_fact" type="number" value="${c.factorEsterilizacion}"></div>
      </div>
      <div class="field"><label>Avisar vencimientos con (días) de anticipación</label><input id="c_dias" type="number" value="${c.diasAvisoVencimiento}"></div>
      <button class="btn btn-primary btn-block" onclick="guardarConfig()">Guardar</button>
    </div>

    <div class="section-title">Profesionales</div>
    <div class="card">
      <p class="muted small">Un nombre por línea. Aparecen al elegir "¿Quién sos?".</p>
      <textarea id="c_profs" rows="5">${esc(App.state.profesionales.join('\n'))}</textarea>
      <button class="btn btn-primary btn-block mt" onclick="guardarProfs()">Guardar profesionales</button>
    </div>

    <div class="section-title">Cajones</div>
    <div class="card">
      <p class="muted small">Código y descripción, uno por línea, separados por " - " (ej: <b>OP-1 - Operatoria</b>).</p>
      <textarea id="c_cajones" rows="6">${esc(App.state.cajones.map(x => x.codigo + ' - ' + x.descripcion).join('\n'))}</textarea>
      <button class="btn btn-primary btn-block mt" onclick="guardarCajones()">Guardar cajones</button>
    </div>
  `;
}
async function guardarConfig() {
  try {
    await api('/config', 'PUT', {
      nombreConsultorio: $('#c_nombre').value.trim(),
      profesionalesSimultaneos: Number($('#c_prof').value) || 1,
      factorEsterilizacion: Number($('#c_fact').value) || 1,
      diasAvisoVencimiento: Number($('#c_dias').value) || 30,
    });
    await loadState();
    $('#brandName').textContent = App.state.config.nombreConsultorio || 'Stock Consultorio';
    toast('Configuración guardada ✓'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function guardarProfs() {
  const profs = $('#c_profs').value.split('\n').map(s => s.trim()).filter(Boolean);
  try { await api('/profesionales', 'PUT', { profesionales: profs }); await loadState(); toast('Guardado ✓'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
async function guardarCajones() {
  const cajones = $('#c_cajones').value.split('\n').map(s => s.trim()).filter(Boolean).map(l => {
    const [codigo, ...rest] = l.split(' - ');
    return { codigo: codigo.trim(), descripcion: rest.join(' - ').trim() };
  });
  try { await api('/cajones', 'PUT', { cajones }); await loadState(); toast('Guardado ✓'); render(); }
  catch (e) { toast(e.message, 'err'); }
}

// =====================================================================
// Arranque
// =====================================================================
(async function init() {
  try {
    await loadState();
    $('#brandName').textContent = App.state.config.nombreConsultorio || 'Stock Consultorio';
    if (App.usuario) $('#whoamiName').textContent = App.usuario;
    go('inicio');
    if (!App.usuario) elegirUsuario(true);
  } catch (e) {
    $('#view').innerHTML = `<div class="empty"><div class="big">⚠️</div>No se pudo conectar con el sistema.<br><span class="small">${esc(e.message)}</span></div>`;
  }
})();
