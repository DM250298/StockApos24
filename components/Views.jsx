'use client';

import { useState } from 'react';
import { Badge, FamiliaBadge, Empty } from '@/components/ui';
import { calcAlertas, armarPedido, diasHasta } from '@/lib/data';
import { marcarEnvase, descartarItem, actualizar, borrar, crear } from '@/lib/actions';

// ===================================================================
// INICIO — tablero de alertas
// ===================================================================
export function InicioView({ ctx }) {
  const a = ctx.alertas;
  const byId = Object.fromEntries(ctx.db.insumos.map((i) => [i.id, i]));

  return (
    <div className="view">
      <h1 className="view-title">Hola{ctx.usuario ? `, ${ctx.usuario}` : ''} 👋</h1>
      <p className="view-sub">Esto es lo que necesita atención hoy.</p>

      <div className="tiles">
        <div className={`tile ${a.bajoMinimo.length ? 'tile-rojo' : 'tile-verde'}`}><div className="n">{a.bajoMinimo.length}</div><div className="l">Bajo mínimo</div></div>
        <div className={`tile ${a.porVencer.length ? 'tile-amarillo' : 'tile-verde'}`}><div className="n">{a.porVencer.length}</div><div className="l">Por vencer / vencidos</div></div>
        <div className={`tile ${a.instrumentalBajo.length ? 'tile-rojo' : 'tile-verde'}`}><div className="n">{a.instrumentalBajo.length}</div><div className="l">Instrumental corto</div></div>
        <div className="tile tile-teal"><div className="n">{a.reposicionPendiente.length}</div><div className="l">En lista de reposición</div></div>
      </div>

      <button className="btn btn-primary btn-block btn-lg mt" onClick={() => ctx.go('pedido')}>🛒 Armar el pedido del mes</button>

      <div className="section-title">🔴 Bajo mínimo</div>
      <div className="card">
        {a.bajoMinimo.length === 0 && <p className="muted small center" style={{ padding: 12 }}>✅ Todo por encima del mínimo.</p>}
        {a.bajoMinimo.map((i) => (
          <div className="alert-item stripe-rojo" key={i.id}>
            <div><div className="nom">{i.nombre}</div><div className="meta"><FamiliaBadge familia={i.familia} /> · 📍 {i.ubicacion || '—'}</div></div>
            <div className="right"><Badge tipo="rojo">{i.stock_actual} / mín {i.stock_minimo}</Badge></div>
          </div>
        ))}
      </div>

      <div className="section-title">🟡 Vencimientos (FEFO)</div>
      <div className="card">
        {a.porVencer.length === 0 && <p className="muted small center" style={{ padding: 12 }}>✅ Nada por vencer pronto.</p>}
        {a.porVencer.map((v) => {
          const vencido = v.dias < 0;
          return (
            <div className={`alert-item ${vencido ? 'stripe-rojo' : 'stripe-amarillo'}`} key={v.id}>
              <div><div className="nom">{v.insumo ? v.insumo.nombre : '?'}</div><div className="meta">Lote {v.lote} · 📍 {v.insumo ? v.insumo.ubicacion : ''}</div></div>
              <div className="right"><Badge tipo={vencido ? 'rojo' : 'amarillo'}>{vencido ? 'VENCIDO' : `vence en ${v.dias} d`}</Badge></div>
            </div>
          );
        })}
      </div>

      <div className="section-title">🦾 Instrumental bajo objetivo</div>
      <div className="card">
        {a.instrumentalBajo.length === 0 && <p className="muted small center" style={{ padding: 12 }}>✅ Dotación completa.</p>}
        {a.instrumentalBajo.map((x) => (
          <div className="alert-item stripe-rojo" key={x.id}>
            <div><div className="nom">{x.nombre}</div><div className="meta">Se pide ya: quedaste corta para atender en simultáneo</div></div>
            <div className="right"><Badge tipo="rojo">{x.dotacion_actual} / obj {x.dotacion_objetivo}</Badge></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// REGISTRO diario
// ===================================================================
export function RegistroView({ ctx }) {
  const granel = ctx.db.insumos.filter((i) => i.familia === 'B');
  const descartables = ctx.db.insumos.filter((i) => i.descartable);

  async function envase(i) {
    if (!ctx.usuario) return ctx.openModal({ type: 'usuario', data: { forzar: true } });
    if (!window.confirm(`¿Marcar un envase de "${i.nombre}" como vaciado? Baja 1 del stock.`)) return;
    try { await marcarEnvase(ctx.supabase, { insumoId: i.id, profesional: ctx.usuario }); await ctx.refetch(); ctx.showToast('Envase vaciado ✓'); }
    catch (e) { ctx.showToast(e.message, 'err'); }
  }
  async function descarte(i) {
    if (!ctx.usuario) return ctx.openModal({ type: 'usuario', data: { forzar: true } });
    if (!window.confirm(`¿Descartar una "${i.nombre}"? Baja 1 y va a la lista de reposición.`)) return;
    try { await descartarItem(ctx.supabase, { insumoId: i.id, profesional: ctx.usuario, motivo: 'Descartada por uso' }); await ctx.refetch(); ctx.showToast('Descartada y anotada ✓'); }
    catch (e) { ctx.showToast(e.message, 'err'); }
  }
  function registrar(t) {
    if (!ctx.usuario) return ctx.openModal({ type: 'usuario', data: { forzar: true } });
    ctx.openModal({ type: 'registro', data: { tratId: t.id } });
  }

  return (
    <div className="view">
      <h1 className="view-title">Registrar</h1>
      <p className="view-sub">Al terminar el día: elegí el tratamiento y el sistema descuenta solo.</p>

      <div className="section-title">Tratamiento que hice</div>
      <div className="treat-grid">
        {ctx.db.tratamientos.length === 0 && <p className="muted">No hay tratamientos cargados todavía.</p>}
        {ctx.db.tratamientos.map((t) => (
          <button className="treat-btn" key={t.id} onClick={() => registrar(t)}>{t.nombre}</button>
        ))}
      </div>

      <div className="section-title">Marcar envase vaciado (granel)</div>
      <p className="muted small" style={{ marginTop: -4 }}>Cuando terminás un frasco/jeringa, marcalo acá. Baja 1 del stock.</p>
      <div className="chips">
        {granel.map((i) => (
          <button className="chip" key={i.id} onClick={() => envase(i)}>{i.nombre} <span className="muted">({i.stock_actual})</span></button>
        ))}
      </div>

      <div className="section-title">Descartar fresa / lima</div>
      <p className="muted small" style={{ marginTop: -4 }}>Se descarta por desgaste o fractura. Baja 1 y va a reposición.</p>
      <div className="chips">
        {descartables.map((i) => (
          <button className="chip" key={i.id} onClick={() => descarte(i)}>{i.nombre} <span className="muted">({i.stock_actual})</span></button>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// CONTEO / reconciliación
// ===================================================================
export function ConteoView({ ctx }) {
  const [valores, setValores] = useState({});
  const cajonNombre = Object.fromEntries(ctx.db.cajones.map((c) => [c.codigo, c.descripcion]));

  const porCajon = {};
  ctx.db.insumos.forEach((i) => {
    const c = i.ubicacion || 'Sin ubicación';
    (porCajon[c] = porCajon[c] || []).push(i);
  });

  function guardar() {
    if (!ctx.usuario) return ctx.openModal({ type: 'usuario', data: { forzar: true } });
    const items = [];
    Object.entries(valores).forEach(([id, val]) => {
      if (val !== '' && val != null) items.push({ insumo_id: id, fisico: Number(val) });
    });
    if (items.length === 0) return ctx.showToast('No anotaste ninguna cantidad.', 'err');
    ctx.openModal({ type: 'conteoRevisar', data: { items } });
  }

  const ultimo = ctx.db.conteos[0];

  return (
    <div className="view">
      <h1 className="view-title">Conteo</h1>
      <p className="view-sub">Recorré cajón por cajón y anotá cuánto hay <b>de verdad</b>. Lo que dejes vacío no se toca.</p>
      {ultimo && <p className="muted small">Último conteo: {ultimo.fecha} por {ultimo.persona || '—'}.</p>}

      {Object.keys(porCajon).sort().map((cod) => (
        <div key={cod}>
          <div className="section-title">📦 {cod} {cajonNombre[cod] ? `· ${cajonNombre[cod]}` : ''}</div>
          <div className="card">
            {porCajon[cod].map((i) => (
              <div className="alert-item" key={i.id}>
                <div>
                  <div className="nom">{i.nombre}</div>
                  <div className="meta">Sistema dice: <b>{i.stock_actual}</b> {i.unidad} · <FamiliaBadge familia={i.familia} /></div>
                </div>
                <input type="number" inputMode="numeric" placeholder={String(i.stock_actual)} style={{ width: 90 }}
                  value={valores[i.id] ?? ''} onChange={(e) => setValores({ ...valores, [i.id]: e.target.value })} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button className="btn btn-primary btn-block btn-lg mt" onClick={guardar}>✓ Guardar conteo y reconciliar</button>
      <div className="spacer" />
    </div>
  );
}

// ===================================================================
// PEDIDO mensual
// ===================================================================
export function PedidoView({ ctx }) {
  const p = armarPedido(ctx.db);
  const colores = { 'Bajo mínimo': 'rojo', 'Vencido': 'rojo', 'Por vencer': 'amarillo', 'Instrumental bajo objetivo': 'C', 'Marcado a mano': 'gris' };

  function copiar() {
    const txt = `PEDIDO ${p.fecha}\n` + p.lineas.map((l) => `• ${l.item} (x${l.sugerido}) — ${l.origen}${l.detalle ? ': ' + l.detalle : ''}`).join('\n');
    navigator.clipboard.writeText(txt).then(() => ctx.showToast('Pedido copiado ✓')).catch(() => ctx.showToast('No se pudo copiar', 'err'));
  }

  return (
    <div className="view">
      <h1 className="view-title no-print">Pedido del mes</h1>
      <p className="view-sub no-print">Junta lo bajo mínimo + instrumental corto + lo que vence + lo marcado a mano. Se lo pasás a la clínica.</p>
      <div className="card no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir / PDF</button>
        <button className="btn btn-ghost" onClick={copiar}>📋 Copiar como texto</button>
      </div>
      <h2 style={{ margin: '16px 0 4px' }}>Pedido — {p.fecha}</h2>
      {p.lineas.length === 0 ? (
        <p className="empty">✅ No hay nada para pedir. Todo en orden.</p>
      ) : (
        <div className="tbl-wrap"><table>
          <thead><tr><th>Motivo</th><th>Ítem</th><th className="right">Sugerido</th><th>Detalle</th><th>Cajón</th></tr></thead>
          <tbody>
            {p.lineas.map((l, idx) => (
              <tr key={idx}>
                <td><Badge tipo={colores[l.origen] || 'gris'}>{l.origen}</Badge></td>
                <td><b>{l.item}</b></td>
                <td className="right">{l.sugerido}</td>
                <td className="muted">{l.detalle}</td>
                <td>{l.ubicacion || ''}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

// ===================================================================
// MÁS — menú
// ===================================================================
export function MasView({ ctx }) {
  const items = [
    ['insumos', '📚', 'Insumos (maestro)', 'Lista de todo, familia, ubicación y mínimo'],
    ['tratamientos', '🍳', 'Tratamientos y recetas', 'Qué descuenta cada tratamiento'],
    ['instrumental', '🦾', 'Instrumental', 'Dotación actual vs. objetivo, roturas'],
    ['vencimientos', '📅', 'Vencimientos', 'Lotes y fechas (FEFO)'],
    ['reposicion', '📝', 'Lista de reposición', 'Lo que se está acabando entre conteos'],
    ['carteles', '🏷️', 'Carteles y mapa de cajones', 'Imprimir lo que va en cada cajón'],
    ['config', '⚙️', 'Configuración', 'Profesionales, factor de esterilización'],
  ];
  return (
    <div className="view">
      <h1 className="view-title">Más</h1>
      <div className="menu-list">
        {items.map(([v, ico, tit, desc]) => (
          <button className="menu-item" key={v} onClick={() => ctx.go(v)}>
            <span className="ico">{ico}</span>
            <div><div>{tit}</div><div className="desc">{desc}</div></div>
          </button>
        ))}
      </div>
      <p className="muted small center mt">Sesión: {ctx.userEmail}</p>
      <button className="btn btn-ghost btn-block mt" onClick={ctx.cerrarSesion}>Cerrar sesión</button>
    </div>
  );
}

// ===================================================================
// INSUMOS (maestro)
// ===================================================================
export function InsumosView({ ctx }) {
  async function borrarInsumo(i) {
    if (!window.confirm(`¿Borrar "${i.nombre}" del maestro?`)) return;
    try { await borrar(ctx.supabase, 'insumos', i.id); await ctx.refetch(); ctx.showToast('Borrado ✓'); }
    catch (e) { ctx.showToast(e.message, 'err'); }
  }
  return (
    <div className="view">
      <div className="card-row"><h1 className="view-title" style={{ margin: 0 }}>Insumos</h1>
        <button className="btn btn-primary btn-sm" onClick={() => ctx.openModal({ type: 'insumo', data: {} })}>＋ Nuevo</button></div>
      <p className="view-sub">El maestro: cuánto hay, dónde está y cuándo se pide.</p>
      <div className="tbl-wrap"><table>
        <thead><tr><th>Nombre</th><th>Familia</th><th>Categoría</th><th className="right">Stock</th><th>Unidad</th><th className="right">Mín</th><th>Cajón</th><th>Vence</th><th></th></tr></thead>
        <tbody>
          {ctx.db.insumos.map((i) => (
            <tr key={i.id} className={Number(i.stock_actual) <= Number(i.stock_minimo) ? 'row-rojo' : ''}>
              <td><b>{i.nombre}</b></td>
              <td><FamiliaBadge familia={i.familia} /></td>
              <td>{i.categoria || ''}</td>
              <td className="right">{i.stock_actual}</td>
              <td>{i.unidad}</td>
              <td className="right">{i.stock_minimo}</td>
              <td>{i.ubicacion || ''}</td>
              <td>{i.vence ? '📅' : ''}</td>
              <td className="nowrap">
                <button className="btn btn-sm btn-ghost" onClick={() => ctx.openModal({ type: 'insumo', data: { id: i.id } })}>✏️</button>{' '}
                <button className="btn btn-sm btn-danger" onClick={() => borrarInsumo(i)}>🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

// ===================================================================
// TRATAMIENTOS
// ===================================================================
export function TratamientosView({ ctx }) {
  const byId = Object.fromEntries(ctx.db.insumos.map((i) => [i.id, i]));
  async function borrarTrat(t) {
    if (!window.confirm('¿Borrar este tratamiento?')) return;
    try { await borrar(ctx.supabase, 'tratamientos', t.id); await ctx.refetch(); ctx.showToast('Borrado ✓'); }
    catch (e) { ctx.showToast(e.message, 'err'); }
  }
  return (
    <div className="view">
      <div className="card-row"><h1 className="view-title" style={{ margin: 0 }}>Tratamientos</h1>
        <button className="btn btn-primary btn-sm" onClick={() => ctx.openModal({ type: 'tratamiento', data: {} })}>＋ Nuevo</button></div>
      <p className="view-sub">La "receta de cocina": qué insumos discretos descuenta cada tratamiento.</p>
      {ctx.db.tratamientos.length === 0 && <Empty icon="🍳">No hay tratamientos.</Empty>}
      {ctx.db.tratamientos.map((t) => {
        const receta = t.receta.map((r) => { const ins = byId[r.insumo_id]; return ins ? `${ins.nombre} ×${r.cantidad}` : ''; }).filter(Boolean).join(' · ');
        return (
          <div className="card" key={t.id}>
            <div className="card-row">
              <b>{t.nombre}</b>
              <div className="nowrap">
                <button className="btn btn-sm btn-ghost" onClick={() => ctx.openModal({ type: 'tratamiento', data: { id: t.id } })}>✏️</button>{' '}
                <button className="btn btn-sm btn-danger" onClick={() => borrarTrat(t)}>🗑️</button>
              </div>
            </div>
            <div className="muted small mt">{receta || 'Sin receta'}</div>
          </div>
        );
      })}
    </div>
  );
}

// ===================================================================
// INSTRUMENTAL
// ===================================================================
export function InstrumentalView({ ctx }) {
  const cfg = ctx.db.config;
  async function romper(x) {
    if (!window.confirm(`¿Se rompió/perdió un "${x.nombre}"? Baja 1 la dotación operativa.`)) return;
    try {
      await actualizar(ctx.supabase, 'instrumental', x.id, { dotacion_actual: Math.max(0, Number(x.dotacion_actual) - 1) });
      await crear(ctx.supabase, 'reposicion', { tipo: 'instrumental', ref_id: x.id, texto: x.nombre, motivo: 'Rotura/pérdida', profesional: ctx.usuario || '', resuelto: false });
      await ctx.refetch(); ctx.showToast('Rotura registrada ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }
  async function borrarInst(x) {
    if (!window.confirm('¿Borrar este instrumento?')) return;
    try { await borrar(ctx.supabase, 'instrumental', x.id); await ctx.refetch(); ctx.showToast('Borrado ✓'); }
    catch (e) { ctx.showToast(e.message, 'err'); }
  }
  return (
    <div className="view">
      <div className="card-row"><h1 className="view-title" style={{ margin: 0 }}>Instrumental</h1>
        <button className="btn btn-primary btn-sm" onClick={() => ctx.openModal({ type: 'instrumental', data: {} })}>＋ Nuevo</button></div>
      <p className="view-sub">Objetivo = {cfg.profesionales_simultaneos} en simultáneo × {cfg.factor_esterilizacion} (esterilización) = <b>{(cfg.profesionales_simultaneos || 0) * (cfg.factor_esterilizacion || 0)}</b>. Si caés por debajo, se pide ya.</p>
      <div className="tbl-wrap"><table>
        <thead><tr><th>Instrumento</th><th className="right">Operativos</th><th className="right">Objetivo</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {ctx.db.instrumental.map((x) => {
            const corto = Number(x.dotacion_actual) < Number(x.dotacion_objetivo);
            return (
              <tr key={x.id} className={corto ? 'row-rojo' : ''}>
                <td><b>{x.nombre}</b></td>
                <td className="right">{x.dotacion_actual}</td>
                <td className="right">{x.dotacion_objetivo}</td>
                <td>{corto ? <Badge tipo="rojo">Pedir ya</Badge> : <Badge tipo="verde">OK</Badge>}</td>
                <td className="nowrap">
                  <button className="btn btn-sm btn-danger" onClick={() => romper(x)}>💥 Rotura</button>{' '}
                  <button className="btn btn-sm btn-ghost" onClick={() => ctx.openModal({ type: 'instrumental', data: { id: x.id } })}>✏️</button>{' '}
                  <button className="btn btn-sm btn-danger" onClick={() => borrarInst(x)}>🗑️</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </div>
  );
}

// ===================================================================
// VENCIMIENTOS
// ===================================================================
export function VencimientosView({ ctx }) {
  const byId = Object.fromEntries(ctx.db.insumos.map((i) => [i.id, i]));
  const dias = ctx.db.config.dias_aviso_vencimiento || 30;
  const items = ctx.db.vencimientos
    .map((v) => ({ ...v, ins: byId[v.insumo_id], dias: diasHasta(v.fecha_vencimiento) }))
    .sort((a, b) => (a.dias == null ? 1 : b.dias == null ? -1 : a.dias - b.dias));

  async function borrarV(v) {
    if (!window.confirm('¿Borrar este lote?')) return;
    try { await borrar(ctx.supabase, 'vencimientos', v.id); await ctx.refetch(); ctx.showToast('Borrado ✓'); }
    catch (e) { ctx.showToast(e.message, 'err'); }
  }
  return (
    <div className="view">
      <div className="card-row"><h1 className="view-title" style={{ margin: 0 }}>Vencimientos</h1>
        <button className="btn btn-primary btn-sm" onClick={() => ctx.openModal({ type: 'vencimiento', data: {} })}>＋ Lote</button></div>
      <p className="view-sub">FEFO: se usa primero lo que vence antes. Ordenado de más urgente a menos.</p>
      {items.length === 0 ? <Empty icon="📅">No hay lotes cargados.</Empty> : (
        <div className="tbl-wrap"><table>
          <thead><tr><th>Insumo</th><th>Lote</th><th>Vence</th><th className="right">Faltan</th><th>Cajón</th><th></th></tr></thead>
          <tbody>
            {items.map((v) => {
              const cls = v.dias < 0 ? 'row-rojo' : (v.dias <= dias ? 'row-amarillo' : '');
              return (
                <tr key={v.id} className={cls}>
                  <td><b>{v.ins ? v.ins.nombre : '?'}</b></td>
                  <td>{v.lote}</td>
                  <td>{v.fecha_vencimiento}</td>
                  <td className="right">{v.dias == null ? '—' : (v.dias < 0 ? <Badge tipo="rojo">VENCIDO</Badge> : `${v.dias} d`)}</td>
                  <td>{v.ins ? v.ins.ubicacion : ''}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => borrarV(v)}>🗑️</button></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

// ===================================================================
// REPOSICIÓN
// ===================================================================
export function ReposicionView({ ctx }) {
  const items = ctx.db.reposicion.filter((r) => !r.resuelto);
  async function resolver(r) {
    try { await actualizar(ctx.supabase, 'reposicion', r.id, { resuelto: true }); await ctx.refetch(); ctx.showToast('Marcado como resuelto ✓'); }
    catch (e) { ctx.showToast(e.message, 'err'); }
  }
  return (
    <div className="view">
      <div className="card-row"><h1 className="view-title" style={{ margin: 0 }}>Reposición</h1>
        <button className="btn btn-primary btn-sm" onClick={() => ctx.openModal({ type: 'reposicion', data: {} })}>＋ Anotar</button></div>
      <p className="view-sub">Reemplaza el papelito: cualquiera anota lo que se está acabando entre conteos. Entra al pedido del mes.</p>
      {items.length === 0 ? <Empty icon="📝">Nada anotado. Todo bajo control.</Empty> : items.map((r) => (
        <div className="card" key={r.id}>
          <div className="card-row">
            <div><b>{r.texto}</b> <Badge tipo="gris">{r.tipo}</Badge>
              <div className="muted small">{r.motivo || ''}{r.profesional ? ` · ${r.profesional}` : ''} · {r.fecha}</div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => resolver(r)}>✓ Listo</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===================================================================
// CARTELES y mapa de cajones
// ===================================================================
export function CartelesView({ ctx }) {
  const cajonNombre = Object.fromEntries(ctx.db.cajones.map((c) => [c.codigo, c.descripcion]));
  const porCajon = {};
  ctx.db.insumos.forEach((i) => {
    const c = i.ubicacion || 'Sin ubicación';
    (porCajon[c] = porCajon[c] || []).push(i.nombre);
  });
  const codigos = Object.keys(porCajon).sort();

  return (
    <div className="view">
      <h1 className="view-title no-print">Carteles de cajones</h1>
      <p className="view-sub no-print">Cada cartel dice <b>qué va en ese cajón</b>, sin cantidades (así casi no envejece). Imprimí y pegá adentro de cada cajón.</p>
      <div className="card no-print"><button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir carteles (uno por hoja)</button></div>
      {codigos.length === 0 ? <Empty icon="🏷️">No hay insumos con ubicación.</Empty> : codigos.map((cod) => (
        <div className="cartel" key={cod}>
          <h2>{cod}</h2>
          <div className="codigo">{cajonNombre[cod] || ''}</div>
          <ul>{porCajon[cod].sort().map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

// ===================================================================
// CONFIGURACIÓN
// ===================================================================
export function ConfigView({ ctx }) {
  const c = ctx.db.config;
  const [nombre, setNombre] = useState(c.nombre_consultorio || '');
  const [prof, setProf] = useState(c.profesionales_simultaneos ?? 4);
  const [fact, setFact] = useState(c.factor_esterilizacion ?? 2);
  const [dias, setDias] = useState(c.dias_aviso_vencimiento ?? 30);
  const [profs, setProfs] = useState(ctx.db.profesionales.map((p) => p.nombre).join('\n'));
  const [cajones, setCajones] = useState(ctx.db.cajones.map((x) => `${x.codigo} - ${x.descripcion}`).join('\n'));

  async function guardarConfig() {
    try {
      await ctx.supabase.from('config').update({
        nombre_consultorio: nombre.trim(),
        profesionales_simultaneos: Number(prof) || 1,
        factor_esterilizacion: Number(fact) || 1,
        dias_aviso_vencimiento: Number(dias) || 30,
      }).eq('id', true);
      await ctx.refetch(); ctx.showToast('Configuración guardada ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  async function guardarProfs() {
    const lista = profs.split('\n').map((s) => s.trim()).filter(Boolean);
    try {
      await ctx.supabase.from('profesionales').delete().neq('nombre', '__nunca__');
      if (lista.length) await ctx.supabase.from('profesionales').insert(lista.map((nombre, idx) => ({ nombre, orden: idx + 1 })));
      await ctx.refetch(); ctx.showToast('Profesionales guardados ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  async function guardarCajones() {
    const lista = cajones.split('\n').map((s) => s.trim()).filter(Boolean).map((l) => {
      const [codigo, ...rest] = l.split(' - ');
      return { codigo: codigo.trim(), descripcion: rest.join(' - ').trim() };
    });
    try {
      // upsert los actuales y borrar los que ya no están
      const codigosNuevos = lista.map((x) => x.codigo);
      const aBorrar = ctx.db.cajones.filter((x) => !codigosNuevos.includes(x.codigo)).map((x) => x.codigo);
      if (lista.length) await ctx.supabase.from('cajones').upsert(lista, { onConflict: 'codigo' });
      if (aBorrar.length) await ctx.supabase.from('cajones').delete().in('codigo', aBorrar);
      await ctx.refetch(); ctx.showToast('Cajones guardados ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  return (
    <div className="view">
      <h1 className="view-title">Configuración</h1>
      <div className="card">
        <div className="field"><label>Nombre del consultorio</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
        <div className="field-row">
          <div className="field"><label>Profesionales en simultáneo</label>
            <input type="number" value={prof} onChange={(e) => setProf(e.target.value)} /></div>
          <div className="field"><label>Factor de esterilización (2× o 3×)</label>
            <input type="number" value={fact} onChange={(e) => setFact(e.target.value)} /></div>
        </div>
        <div className="field"><label>Avisar vencimientos con (días) de anticipación</label>
          <input type="number" value={dias} onChange={(e) => setDias(e.target.value)} /></div>
        <button className="btn btn-primary btn-block" onClick={guardarConfig}>Guardar</button>
      </div>

      <div className="section-title">Profesionales</div>
      <div className="card">
        <p className="muted small">Un nombre por línea. Aparecen al elegir "¿Quién sos?".</p>
        <textarea rows={5} value={profs} onChange={(e) => setProfs(e.target.value)} />
        <button className="btn btn-primary btn-block mt" onClick={guardarProfs}>Guardar profesionales</button>
      </div>

      <div className="section-title">Cajones</div>
      <div className="card">
        <p className="muted small">Código y descripción, uno por línea, separados por " - " (ej: <b>OP-1 - Operatoria</b>).</p>
        <textarea rows={6} value={cajones} onChange={(e) => setCajones(e.target.value)} />
        <button className="btn btn-primary btn-block mt" onClick={guardarCajones}>Guardar cajones</button>
      </div>
    </div>
  );
}
