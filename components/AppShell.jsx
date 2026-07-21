'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchAll, calcAlertas, TABLAS } from '@/lib/data';
import { ModalHost } from '@/components/Modals';
import {
  InicioView, RegistroView, ConteoView, PedidoView, MasView,
  InsumosView, TratamientosView, InstrumentalView, VencimientosView,
  ReposicionView, CartelesView, ConfigView,
} from '@/components/Views';

const VIEWS = {
  inicio: InicioView, registro: RegistroView, conteo: ConteoView,
  pedido: PedidoView, mas: MasView, insumos: InsumosView,
  tratamientos: TratamientosView, instrumental: InstrumentalView,
  vencimientos: VencimientosView, reposicion: ReposicionView,
  carteles: CartelesView, config: ConfigView,
};

const SUBVIEWS = ['insumos', 'tratamientos', 'instrumental', 'vencimientos', 'reposicion', 'carteles', 'config'];

const TABS = [
  ['inicio', '🏠', 'Inicio'],
  ['registro', '✍️', 'Registrar'],
  ['conteo', '📋', 'Conteo'],
  ['pedido', '🛒', 'Pedido'],
  ['mas', '⋯', 'Más'],
];

export default function AppShell({ userEmail }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [db, setDb] = useState(null);
  const [view, setView] = useState('inicio');
  const [usuario, setUsuarioState] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  const toastTimer = useRef(null);
  const refetchRef = useRef(null);

  const refetch = useCallback(async () => {
    setDb(await fetchAll(supabase));
  }, [supabase]);
  refetchRef.current = refetch;

  // Carga inicial + realtime
  useEffect(() => {
    refetch();
    const saved = typeof window !== 'undefined' ? localStorage.getItem('usuario') : null;
    if (saved) setUsuarioState(saved);

    const ch = supabase.channel('stock-realtime');
    TABLAS.forEach((t) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        refetchRef.current && refetchRef.current();
      });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, refetch]);

  // Pedir identidad la primera vez
  useEffect(() => {
    if (db && !usuario && !modal) {
      setModal({ type: 'usuario', data: { forzar: true } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const alertas = useMemo(() => (db ? calcAlertas(db) : null), [db]);

  const showToast = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const setUsuario = useCallback((nombre) => {
    setUsuarioState(nombre);
    try { localStorage.setItem('usuario', nombre); } catch {}
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
    db, alertas, usuario, userEmail, supabase,
    refetch, showToast, openModal, closeModal, go, setUsuario, cerrarSesion,
  };

  if (!db || !alertas) {
    return <div className="empty" style={{ paddingTop: 120 }}><div className="big">🦷</div>Cargando…</div>;
  }

  const View = VIEWS[view] || InicioView;
  const activeTab = SUBVIEWS.includes(view) ? 'mas' : view;

  return (
    <div className="app-body">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">🦷 {db.config.nombre_consultorio || 'Stock Consultorio'}</div>
          <button className="whoami" onClick={() => openModal({ type: 'usuario', data: {} })}>
            👤 {usuario || 'Elegir'}
          </button>
        </div>
      </header>

      <main>
        <View ctx={ctx} />
      </main>

      <nav className="tabbar">
        {TABS.map(([v, ico, label]) => (
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
