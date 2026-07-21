// Mutaciones. Las de lógica de negocio usan funciones RPC de Postgres
// (atómicas); el CRUD simple usa supabase-js directo con RLS.

export async function registrarTratamiento(supabase, { profesional, tratamientoId, extras }) {
  const { data, error } = await supabase.rpc('registrar_tratamiento', {
    p_profesional: profesional,
    p_tratamiento_id: tratamientoId,
    p_extras: extras || [],
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function marcarEnvase(supabase, { insumoId, profesional }) {
  const { error } = await supabase.rpc('marcar_envase', {
    p_insumo_id: insumoId, p_profesional: profesional,
  });
  if (error) throw new Error(error.message);
}

export async function descartarItem(supabase, { insumoId, profesional, motivo }) {
  const { error } = await supabase.rpc('descartar_item', {
    p_insumo_id: insumoId, p_profesional: profesional,
    p_motivo: motivo || 'Descartada por uso',
  });
  if (error) throw new Error(error.message);
}

export async function registrarConteo(supabase, { persona, items }) {
  const { data, error } = await supabase.rpc('registrar_conteo', {
    p_persona: persona, p_items: items,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ---- CRUD genérico ----
export async function crear(supabase, tabla, fila) {
  const { data, error } = await supabase.from(tabla).insert(fila).select().single();
  if (error) throw new Error(error.message);
  return data;
}
export async function actualizar(supabase, tabla, id, cambios, pk = 'id') {
  const { error } = await supabase.from(tabla).update(cambios).eq(pk, id);
  if (error) throw new Error(error.message);
}
export async function borrar(supabase, tabla, id, pk = 'id') {
  const { error } = await supabase.from(tabla).delete().eq(pk, id);
  if (error) throw new Error(error.message);
}

// Reemplaza la receta completa de un tratamiento.
export async function guardarReceta(supabase, tratamientoId, receta) {
  await supabase.from('recetas').delete().eq('tratamiento_id', tratamientoId);
  if (receta.length) {
    const filas = receta.map((r) => ({
      tratamiento_id: tratamientoId, insumo_id: r.insumo_id, cantidad: r.cantidad,
    }));
    const { error } = await supabase.from('recetas').insert(filas);
    if (error) throw new Error(error.message);
  }
}
