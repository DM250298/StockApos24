'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchAll, calcAlertas, TABLAS } from '@/lib/data';
import { ModalHost } from '@/components/Modals';
import {
  InicioView, RegistroView, ConteoView, PedidoView, MasView,
  InsumosView, TratamientosView, InstrumentalView, VencimientosView,
  ReposicionView, CartelesView, ConfigView, UsuariosView,
} from '@/components/Views';

const VIEWS = {
  inicio: InicioView, registro: RegistroView, conteo: ConteoView,
  pedido: PedidoView, mas: MasView, insumos: InsumosView,
  tratamientos: TratamientosView, instrumental: InstrumentalView,
  vencimientos: VencimientosView, reposicion: ReposicionView,
  carteles: CartelesView, config: ConfigView, usuarios: UsuariosView,
};

// Vistas exclusivas del admin (el odontólogo no las puede abrir)
const ADMIN_ONLY = new Set([
  'conteo', 'pedido', 'mas', 'insumos', 'tratamientos', 'instrumental',
  'vencimientos', 'carteles', 'config', 'usuarios',
]);

// Vistas que, para el admin, cuelgan del menú "Más"
const BAJO_MAS = new Set([
  'insumos', 'tratamientos', 'instrumental', 'vencimientos',
  'carteles', 'config', 'usuarios', 'reposicion',
]);

const TABS_ADMIN = [
  ['inicio', '🏠', 'Inicio'],
  ['registro', '✍️', 'Registrar'],
  ['conteo', '📋', 'Conteo'],
  ['pedido', '🛒', 'Pedido'],
  ['mas', '⋯', 'Más'],
];
const TABS_ODONTO = [
  ['inicio', '🏠', 'Inicio'],
  ['registro', '✍️', 'Registrar'],
  ['reposicion', '📝', 'Reposición'],
];

export default function AppShell({ userEmail }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [view, setView] = useState('inicio');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  const toastTimer = useRef(null);
  const refetchRef = useRef(null);

  const refetch = useCallback(async () => {
    setDb(await fetchAll(supabase));
  }, [supabase]);
  refetchRef.current = refetch;

  // Carga inicial + identidad + realtime
  useEffect(() => {
    refetch();
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));

    const ch = supabase.channel('stock-realtime');
    TABLAS.forEach((t) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        refetchRef.current && refetchRef.current();
      });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, refetch]);

  const alertas = useMemo(() => (db ? calcAlertas(db) : null), [db]);

  const perfil = useMemo(
    () => (db && userId ? db.perfiles.find((p) => p.id === userId) : null),
    [db, userId]
  );
  const rol = perfil ? perfil.rol : 'odontologo';
  const esAdmin = rol === 'admin';
  const usuario = (perfil && perfil.nombre) || userEmail;

  const showToast = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const go = useCallback((v) => { setView(v); window.scrollTo(0, 0); }, []);
  const openModal = useCallback((desc) => setModal(desc), []);
  const closeModal = useCallback(() => setModal(null), []);

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [supabase, router]);

  const ctx = {
    db, alertas, usuario, userEmail, userId, rol, esAdmin, supabase,
    refetch, showToast, openModal, closeModal, go, cerrarSesion,
  };

  if (!db || !alertas || !userId) {
    return (
      <div className="empty" style={{ paddingTop: 140 }}>
        <img src="/apos24-logo-full.png" alt="APOS24" style={{ height: 54, marginBottom: 16 }} />
        <div className="muted">Cargando…</div>
      </div>
    );
  }

  const puedeVer = esAdmin || !ADMIN_ONLY.has(view);
  const View = puedeVer ? (VIEWS[view] || InicioView) : null;
  const tabs = esAdmin ? TABS_ADMIN : TABS_ODONTO;
  const activeTab = esAdmin && BAJO_MAS.has(view) ? 'mas' : view;

  return (
    <div className="app-body">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img src="/apos24-logo-full.png" alt="APOS24" />
            <span className="brand-sep" />
            <span className="brand-txt">STOCK</span>
          </div>
          <button className="whoami" onClick={() => openModal({ type: 'cuenta' })}>
            👤 {usuario}{esAdmin ? ' · Admin' : ''}
          </button>
        </div>
      </header>

      <main>
        {View ? <View ctx={ctx} /> : (
          <div className="view"><div className="empty"><div className="big">🔒</div>No tenés permiso para ver esta sección.</div></div>
        )}
      </main>

      <nav className="tabbar">
        {tabs.map(([v, ico, label]) => (
          <button key={v} className={`tab ${activeTab === v ? 'active' : ''}`} onClick={() => go(v)}>
            {ico}<span>{label}</span>
          </button>
        ))}
      </nav>

      {modal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !modal.data?.forzar) closeModal(); }}>
          <div className="modal">
            <ModalHost modal={modal} ctx={ctx} />
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
