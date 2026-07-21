'use client';

// Piezas de interfaz compartidas.

export function Badge({ tipo, children }) {
  return <span className={`badge badge-${tipo}`}>{children}</span>;
}

export function FamiliaBadge({ familia }) {
  const nom = { A: 'Discreto', B: 'Granel', C: 'Instrumental' }[familia] || familia;
  return <span className={`badge badge-${familia}`}>{familia} · {nom}</span>;
}

export function Empty({ icon = '📭', children }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      {children}
    </div>
  );
}
