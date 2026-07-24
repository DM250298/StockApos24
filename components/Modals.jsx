'use client';

import { useState } from 'react';
import { BtnAsync } from '@/components/ui';
import {
  registrarTratamiento, registrarConteo,
  crear, actualizar, guardarReceta,
} from '@/lib/actions';

// -------------------------------------------------------------------
// Host: elige qué modal mostrar según modal.type
// -------------------------------------------------------------------
export function ModalHost({ modal, ctx }) {
  if (!modal) return null;
  const map = {
    cuenta: CuentaModal,
    perfil: PerfilModal,
    registro: RegistroModal,
    conteoRevisar: ConteoRevisarModal,
    insumo: InsumoModal,
    tratamiento: TratamientoModal,
    instrumental: InstrumentalModal,
    vencimiento: VencimientoModal,
    reposicion: ReposicionModal,
  };
  const Comp = map[modal.type];
  return Comp ? <Comp ctx={ctx} data={modal.data || {}} /> : null;
}

// Envoltorio con botones estándar
function Wrap({ title, children, onSave, saveLabel = 'Guardar', ctx, canCancel = true }) {
  return (
    <>
      <h3 className="modal-title">{title}</h3>
      {children}
      <div className="modal-actions">
        {canCancel && <button className="btn btn-ghost" onClick={ctx.closeModal}>Cancelar</button>}
        {onSave && <BtnAsync className="btn btn-primary" onClick={onSave}>{saveLabel}</BtnAsync>}
      </div>
    </>
  );
}

// -------------------------------------------------------------------
// Mi cuenta (nombre, rol, cerrar sesión)
// -------------------------------------------------------------------
function CuentaModal({ ctx }) {
  return (
    <>
      <h3 className="modal-title">Mi cuenta</h3>
      <div className="card" style={{ boxShadow: 'none' }}>
        <div className="alert-item"><span className="muted">Nombre</span><b>{ctx.usuario}</b></div>
        <div className="alert-item"><span className="muted">Rol</span>
          <span className={`badge ${ctx.esAdmin ? 'badge-C' : 'badge-A'}`}>{ctx.esAdmin ? 'Administrador' : 'Odontólogo'}</span>
        </div>
        <div className="alert-item"><span className="muted">Cuenta</span><span className="small">{ctx.userEmail}</span></div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={ctx.closeModal}>Cerrar</button>
        <button className="btn btn-danger" onClick={ctx.cerrarSesion}>Cerrar sesión</button>
      </div>
    </>
  );
}

// -------------------------------------------------------------------
// Editar perfil de un usuario (solo admin): nombre visible + rol
// -------------------------------------------------------------------
function PerfilModal({ ctx, data }) {
  const p = ctx.db.perfiles.find((x) => x.id === data.id);
  const [nombre, setNombre] = useState(p ? p.nombre : '');
  const [rol, setRol] = useState(p ? p.rol : 'odontologo');

  async function guardar() {
    if (!nombre.trim()) return ctx.showToast('Poné un nombre.', 'err');
    try {
      await actualizar(ctx.supabase, 'perfiles', data.id, { nombre: nombre.trim(), rol });
      ctx.closeModal(); await ctx.refetch(); ctx.showToast('Perfil guardado ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  return (
    <Wrap title="Editar usuario" ctx={ctx} onSave={guardar}>
      <p className="muted small">{p ? p.email : ''}</p>
      <div className="field"><label>Nombre visible</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Dra. Martínez" /></div>
      <div className="field"><label>Rol</label>
        <select value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="odontologo">Odontólogo (registrar y reposición)</option>
          <option value="admin">Administrador (puede todo)</option>
        </select></div>
    </Wrap>
  );
}

// -------------------------------------------------------------------
// Registrar tratamiento
// -------------------------------------------------------------------
function RegistroModal({ ctx, data }) {
  const trat = ctx.db.tratamientos.find((t) => t.id === data.tratId);
  const byId = Object.fromEntries(ctx.db.insumos.map((i) => [i.id, i]));
  const [extras, setExtras] = useState([]);
  const [selIns, setSelIns] = useState('');
  const [selCant, setSelCant] = useState(1);

  if (!trat) return <Wrap title="Error" ctx={ctx}><p>Tratamiento no encontrado.</p></Wrap>;

  const recetaA = trat.receta.map((r) => ({ ...r, ins: byId[r.insumo_id] })).filter((r) => r.ins);
  const insumosA = ctx.db.insumos.filter((i) => i.familia === 'A');

  function addExtra() {
    if (!selIns) return;
    setExtras([...extras, { insumo_id: selIns, cantidad: Number(selCant) || 1 }]);
    setSelIns(''); setSelCant(1);
  }

  async function confirmar() {
    try {
      await registrarTratamiento(ctx.supabase, {
        profesional: ctx.usuario, tratamientoId: trat.id, extras,
      });
      ctx.closeModal();
      await ctx.refetch();
      ctx.showToast('Tratamiento registrado ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  return (
    <Wrap title={trat.nombre} ctx={ctx} onSave={confirmar} saveLabel="✓ Registrar">
      <p className="muted small">Se va a descontar automáticamente:</p>
      <div className="card" style={{ boxShadow: 'none' }}>
        {recetaA.length === 0 && <p className="muted small">Sin receta.</p>}
        {recetaA.map((r) => (
          <div className="alert-item" key={r.id}>
            <div>
              <span className="nom">{r.ins.nombre}</span>{' '}
              {r.ins.familia !== 'A' && <span className="badge badge-B">solo estadística</span>}
            </div>
            <div className="right muted">
              {r.ins.familia === 'A' ? `−${r.cantidad} ${r.ins.unidad}` : 'no descuenta'}
            </div>
          </div>
        ))}
      </div>

      <div className="field">
        <label>¿Usaste algo fuera de la receta? (opcional)</label>
        {extras.map((e, idx) => {
          const ins = byId[e.insumo_id];
          return (
            <div className="alert-item" key={idx}>
              <span className="nom">{ins ? ins.nombre : '?'}</span>
              <div className="right">
                <span className="muted">−{e.cantidad}</span>
                <button className="btn btn-sm btn-danger" style={{ marginLeft: 8 }}
                  onClick={() => setExtras(extras.filter((_, i) => i !== idx))}>Quitar</button>
              </div>
            </div>
          );
        })}
        <div className="field-row" style={{ marginTop: 8 }}>
          <select value={selIns} onChange={(e) => setSelIns(e.target.value)}>
            <option value="">Agregar insumo…</option>
            {insumosA.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
          <input type="number" min="1" value={selCant} style={{ maxWidth: 80 }}
            onChange={(e) => setSelCant(e.target.value)} />
          <button className="btn btn-ghost btn-sm" onClick={addExtra}>Agregar</button>
        </div>
      </div>
    </Wrap>
  );
}

// -------------------------------------------------------------------
// Revisar desvío del conteo antes de confirmar
// -------------------------------------------------------------------
function ConteoRevisarModal({ ctx, data }) {
  const items = data.items || [];
  const byId = Object.fromEntries(ctx.db.insumos.map((i) => [i.id, i]));

  async function confirmar() {
    try {
      await registrarConteo(ctx.supabase, { persona: ctx.usuario, items });
      ctx.closeModal();
      await ctx.refetch();
      ctx.showToast('Conteo guardado y stock ajustado ✓');
      ctx.go('inicio');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  return (
    <Wrap title="Revisá las diferencias" ctx={ctx} onSave={confirmar} saveLabel="✓ Confirmar">
      <p className="muted small">
        El número que contaste va a reemplazar al del sistema. Las diferencias pueden ser
        por consumo real, roturas o algo que no se registró.
      </p>
      <div className="tbl-wrap mt">
        <table>
          <thead><tr><th>Insumo</th><th className="right">Sistema</th><th className="right">Contado</th><th className="right">Diferencia</th></tr></thead>
          <tbody>
            {items.map((it) => {
              const ins = byId[it.insumo_id];
              const desvio = it.fisico - Number(ins.stock_actual);
              const cls = desvio === 0 ? 'verde' : (desvio < 0 ? 'rojo' : 'amarillo');
              return (
                <tr key={it.insumo_id}>
                  <td>{ins.nombre}</td>
                  <td className="right">{ins.stock_actual}</td>
                  <td className="right">{it.fisico}</td>
                  <td className="right"><span className={`badge badge-${cls}`}>{desvio > 0 ? '+' : ''}{desvio}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Wrap>
  );
}

// -------------------------------------------------------------------
// Insumo (maestro)
// -------------------------------------------------------------------
function InsumoModal({ ctx, data }) {
  const orig = data.id ? ctx.db.insumos.find((i) => i.id === data.id) : null;
  const [f, setF] = useState(orig || {
    nombre: '', familia: 'A', unidad: 'unidad', categoria: '',
    stock_actual: 0, stock_minimo: 0, ubicacion: '', vence: false, descartable: false,
  });
  const set = (k, v) => setF({ ...f, [k]: v });

  async function guardar() {
    if (!f.nombre.trim()) return ctx.showToast('Poné un nombre.', 'err');
    const fila = {
      nombre: f.nombre.trim(), familia: f.familia, unidad: f.unidad.trim() || 'unidad',
      categoria: f.categoria || '', stock_actual: Number(f.stock_actual) || 0,
      stock_minimo: Number(f.stock_minimo) || 0, ubicacion: f.ubicacion || null,
      vence: !!f.vence, descartable: !!f.descartable,
    };
    try {
      if (data.id) await actualizar(ctx.supabase, 'insumos', data.id, fila);
      else await crear(ctx.supabase, 'insumos', fila);
      ctx.closeModal(); await ctx.refetch(); ctx.showToast('Guardado ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  return (
    <Wrap title={`${data.id ? 'Editar' : 'Nuevo'} insumo`} ctx={ctx} onSave={guardar}>
      <div className="field"><label>Nombre</label>
        <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} /></div>
      <div className="field-row">
        <div className="field"><label>Familia</label>
          <select value={f.familia} onChange={(e) => set('familia', e.target.value)}>
            <option value="A">A · Por unidad</option>
            <option value="B">B · Granel (por envase)</option>
          </select></div>
        <div className="field"><label>Unidad</label>
          <input value={f.unidad} onChange={(e) => set('unidad', e.target.value)} placeholder="caja, jeringa…" /></div>
      </div>
      <div className="field"><label>Categoría</label>
        <input value={f.categoria} onChange={(e) => set('categoria', e.target.value)} /></div>
      <div className="field-row">
        <div className="field"><label>Stock actual</label>
          <input type="number" value={f.stock_actual} onChange={(e) => set('stock_actual', e.target.value)} /></div>
        <div className="field"><label>Stock mínimo</label>
          <input type="number" value={f.stock_minimo} onChange={(e) => set('stock_minimo', e.target.value)} /></div>
      </div>
      <div className="field"><label>Ubicación (cajón)</label>
        <select value={f.ubicacion || ''} onChange={(e) => set('ubicacion', e.target.value)}>
          <option value="">— Sin ubicación —</option>
          {ctx.db.cajones.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.descripcion}</option>)}
        </select></div>
      <div className="field-row">
        <label className="check"><input type="checkbox" checked={!!f.vence} onChange={(e) => set('vence', e.target.checked)} /> ¿Vence?</label>
        <label className="check"><input type="checkbox" checked={!!f.descartable} onChange={(e) => set('descartable', e.target.checked)} /> ¿Fresa/lima descartable?</label>
      </div>
    </Wrap>
  );
}

// -------------------------------------------------------------------
// Tratamiento + receta
// -------------------------------------------------------------------
function TratamientoModal({ ctx, data }) {
  const orig = data.id ? ctx.db.tratamientos.find((t) => t.id === data.id) : null;
  const [nombre, setNombre] = useState(orig ? orig.nombre : '');
  const [receta, setReceta] = useState(orig ? orig.receta.map((r) => ({ insumo_id: r.insumo_id, cantidad: r.cantidad })) : []);
  const [selIns, setSelIns] = useState('');
  const [selCant, setSelCant] = useState(1);
  const byId = Object.fromEntries(ctx.db.insumos.map((i) => [i.id, i]));
  const insumosA = ctx.db.insumos.filter((i) => i.familia === 'A');

  function addReceta() {
    if (!selIns) return;
    setReceta([...receta, { insumo_id: selIns, cantidad: Number(selCant) || 1 }]);
    setSelIns(''); setSelCant(1);
  }

  async function guardar() {
    if (!nombre.trim()) return ctx.showToast('Poné un nombre.', 'err');
    try {
      let id = data.id;
      if (id) await actualizar(ctx.supabase, 'tratamientos', id, { nombre: nombre.trim() });
      else { const nuevo = await crear(ctx.supabase, 'tratamientos', { nombre: nombre.trim() }); id = nuevo.id; }
      await guardarReceta(ctx.supabase, id, receta);
      ctx.closeModal(); await ctx.refetch(); ctx.showToast('Guardado ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  return (
    <Wrap title={`${data.id ? 'Editar' : 'Nuevo'} tratamiento`} ctx={ctx} onSave={guardar}>
      <div className="field"><label>Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
      <label className="small" style={{ fontWeight: 600 }}>Receta (solo insumos por unidad / familia A)</label>
      <div className="mt">
        {receta.length === 0 && <p className="muted small">Todavía sin insumos.</p>}
        {receta.map((r, idx) => {
          const ins = byId[r.insumo_id];
          return (
            <div className="alert-item" key={idx}>
              <span className="nom">{ins ? ins.nombre : '?'}</span>
              <div className="right">
                <span className="muted">×{r.cantidad}</span>
                <button className="btn btn-sm btn-danger" style={{ marginLeft: 8 }}
                  onClick={() => setReceta(receta.filter((_, i) => i !== idx))}>Quitar</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="field-row" style={{ marginTop: 8 }}>
        <select value={selIns} onChange={(e) => setSelIns(e.target.value)}>
          <option value="">Agregar insumo…</option>
          {insumosA.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <input type="number" min="1" value={selCant} style={{ maxWidth: 80 }}
          onChange={(e) => setSelCant(e.target.value)} />
        <button className="btn btn-ghost btn-sm" onClick={addReceta}>Agregar</button>
      </div>
    </Wrap>
  );
}

// -------------------------------------------------------------------
// Instrumental
// -------------------------------------------------------------------
function InstrumentalModal({ ctx, data }) {
  const orig = data.id ? ctx.db.instrumental.find((i) => i.id === data.id) : null;
  const objetivoDefault = (ctx.db.config.profesionales_simultaneos || 4) * (ctx.db.config.factor_esterilizacion || 2);
  const [nombre, setNombre] = useState(orig ? orig.nombre : '');
  const [act, setAct] = useState(orig ? orig.dotacion_actual : 0);
  const [obj, setObj] = useState(orig ? orig.dotacion_objetivo : objetivoDefault);

  async function guardar() {
    if (!nombre.trim()) return ctx.showToast('Poné un nombre.', 'err');
    const fila = { nombre: nombre.trim(), dotacion_actual: Number(act) || 0, dotacion_objetivo: Number(obj) || 0 };
    try {
      if (data.id) await actualizar(ctx.supabase, 'instrumental', data.id, fila);
      else await crear(ctx.supabase, 'instrumental', { ...fila, estado: 'operativo' });
      ctx.closeModal(); await ctx.refetch(); ctx.showToast('Guardado ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  return (
    <Wrap title={`${data.id ? 'Editar' : 'Nuevo'} instrumento`} ctx={ctx} onSave={guardar}>
      <div className="field"><label>Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
      <div className="field-row">
        <div className="field"><label>Operativos ahora</label>
          <input type="number" value={act} onChange={(e) => setAct(e.target.value)} /></div>
        <div className="field"><label>Dotación objetivo</label>
          <input type="number" value={obj} onChange={(e) => setObj(e.target.value)} /></div>
      </div>
    </Wrap>
  );
}

// -------------------------------------------------------------------
// Vencimiento (lote)
// -------------------------------------------------------------------
function VencimientoModal({ ctx, data }) {
  const insumosVence = ctx.db.insumos.filter((i) => i.vence);
  const [insumoId, setInsumoId] = useState(insumosVence[0] ? insumosVence[0].id : '');
  const [lote, setLote] = useState('');
  const [fecha, setFecha] = useState('');

  async function guardar() {
    if (!insumoId || !fecha) return ctx.showToast('Completá insumo y fecha.', 'err');
    try {
      await crear(ctx.supabase, 'vencimientos', { insumo_id: insumoId, lote: lote.trim(), fecha_vencimiento: fecha });
      ctx.closeModal(); await ctx.refetch(); ctx.showToast('Lote guardado ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  return (
    <Wrap title="Nuevo lote" ctx={ctx} onSave={guardar}>
      <div className="field"><label>Insumo</label>
        <select value={insumoId} onChange={(e) => setInsumoId(e.target.value)}>
          {insumosVence.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select></div>
      <div className="field-row">
        <div className="field"><label>Lote</label>
          <input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="L-2025-A" /></div>
        <div className="field"><label>Fecha de vencimiento</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
      </div>
    </Wrap>
  );
}

// -------------------------------------------------------------------
// Reposición (anotar a mano)
// -------------------------------------------------------------------
function ReposicionModal({ ctx, data }) {
  const [texto, setTexto] = useState('');
  const [motivo, setMotivo] = useState('');

  async function guardar() {
    if (!texto.trim()) return ctx.showToast('Escribí qué falta.', 'err');
    try {
      await crear(ctx.supabase, 'reposicion', {
        tipo: 'manual', texto: texto.trim(), motivo: motivo.trim(),
        profesional: ctx.usuario || '', resuelto: false,
      });
      ctx.closeModal(); await ctx.refetch(); ctx.showToast('Anotado ✓');
    } catch (e) { ctx.showToast(e.message, 'err'); }
  }

  return (
    <Wrap title="Anotar para reponer" ctx={ctx} onSave={guardar} saveLabel="Anotar">
      <div className="field"><label>¿Qué falta?</label>
        <input value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: se están acabando las agujas largas" /></div>
      <div className="field"><label>Nota (opcional)</label>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="motivo / cantidad" /></div>
    </Wrap>
  );
}
