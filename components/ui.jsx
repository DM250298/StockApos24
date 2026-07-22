'use client';

import { useState } from 'react';

// Piezas de interfaz compartidas.

export function Badge({ tipo, children }) {
  return <span className={`badge badge-${tipo}`}>{children}</span>;
}

export function FamiliaBadge({ familia }) {
  const nom = { A: 'Por unidad', B: 'Granel', C: 'Instrumental' }[familia] || familia;
  return <span className={`badge badge-${familia}`}>{familia} · {nom}</span>;
}

export function Empty({ icon = '📭', children, action }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div>{children}</div>
      {action && <div className="mt">{action}</div>}
    </div>
  );
}

// Botón para acciones asíncronas: se deshabilita y muestra "cargando"
// mientras corre, para evitar el doble toque (que descontaría stock dos
// veces o duplicaría registros) y dar feedback de que algo está pasando.
export function BtnAsync({ onClick, className = 'btn btn-primary', children, labelEnviando = 'Guardando…' }) {
  const [enviando, setEnviando] = useState(false);
  async function handle() {
    if (enviando) return;
    setEnviando(true);
    try {
      await onClick();
    } finally {
      setEnviando(false);
    }
  }
  return (
    <button className={className} onClick={handle} disabled={enviando}>
      {enviando ? labelEnviando : children}
    </button>
  );
}
