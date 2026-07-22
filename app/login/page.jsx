'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Email o contraseña incorrectos.');
      setCargando(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={entrar}>
        <img className="login-logo-img" src="/apos24-logo-full.png" alt="APOS24" />
        <div className="login-title">Control de Stock</div>
        <div className="login-sub">Entrá con la cuenta del consultorio</div>

        {error && <div className="login-err">{error}</div>}

        <div className="field">
          <label>Email</label>
          <input
            type="email" value={email} autoComplete="username"
            onChange={(e) => setEmail(e.target.value)} required
          />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input
            type="password" value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)} required
          />
        </div>
        <button className="btn btn-primary btn-block btn-lg" disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
