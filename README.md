# 🦷 Sistema de Stock — Consultorio Odontológico

App web para controlar el stock del consultorio: **cuánto** hay de cada cosa, **dónde** está y **cuándo** vence, con pedido mensual automático. Pensada para usarse desde la computadora y desde el celular, por los 4 profesionales a la vez.

**Stack:** Next.js (App Router) · Supabase (Postgres + Auth + Realtime) · deploy en Vercel desde GitHub.

- **Una cuenta compartida** del consultorio para entrar. Adentro, cada uno elige su nombre (sin contraseña) para registrar.
- **Sincronización en vivo:** lo que carga uno, los demás lo ven al instante.
- Datos y backups a cargo de Supabase (respaldos automáticos en la nube).

---

## 🚀 Puesta en marcha (una sola vez, ~15 min)

Necesitás tres cuentas, **todas con plan gratis que sobra** para esto:
[GitHub](https://github.com), [Supabase](https://supabase.com), [Vercel](https://vercel.com).

### Paso 1 — Subir el código a GitHub

Desde esta carpeta:

```bash
git init
git add .
git commit -m "Sistema de stock del consultorio"
```

Creá un repositorio nuevo en GitHub (privado) y seguí las instrucciones que te da para "push an existing repository", que son:

```bash
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

> El archivo `.gitignore` ya evita subir claves y `node_modules`.

### Paso 2 — Crear la base de datos en Supabase

1. En [supabase.com](https://supabase.com) → **New project**. Elegí nombre, una contraseña de base de datos (guardala) y una región cercana (ej. São Paulo). Esperá 1–2 min a que se cree.
2. Menú lateral → **SQL Editor** → **New query**.
3. Abrí el archivo [`supabase/schema.sql`](supabase/schema.sql), copiá **todo**, pegalo y apretá **Run**. Crea las tablas, los usuarios/roles, la seguridad y las funciones. (Es seguro de correr de nuevo: no borra datos.)
4. Nueva query. Abrí [`supabase/seed.sql`](supabase/seed.sql), copiá todo, pegá y **Run**. Carga los datos de ejemplo.

### Paso 3 — Crear el usuario administrador

1. Menú lateral → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Poné tu email y una contraseña. **Marcá "Auto Confirm User"** para que quede activo sin verificar el mail.
3. El **primer** usuario que creás queda automáticamente como **Administrador** (puede todo). A los doctores los agregás después, desde la app (ver más abajo) y quedan como Odontólogo.
4. (Recomendado) **Authentication → Sign In / Providers → Email**: desactivá **"Allow new users to sign up"**. Así solo vos creás las cuentas.

### Paso 4 — Copiar las claves de la API

Menú lateral → **Project Settings** → **API**. Anotá:

- **Project URL** (algo como `https://xxxx.supabase.co`)
- **anon public** key (una clave larga)

> La `anon key` es pública y segura de exponer: el acceso real lo controlan las políticas de seguridad (RLS) de la base, que solo dejan entrar a usuarios logueados.

### Paso 5 — Deploy en Vercel

1. En [vercel.com](https://vercel.com) entrá con tu cuenta de GitHub → **Add New… → Project** → importá el repo que subiste.
2. Antes de deployar, abrí **Environment Variables** y cargá estas dos:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL del Paso 4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la anon key del Paso 4 |

3. **Deploy**. En ~1 min te da una URL pública (ej. `https://tu-repo.vercel.app`).
4. Entrá a esa URL, logueate con el usuario administrador del Paso 3. ¡Listo!

> Cada vez que hagas `git push`, Vercel vuelve a deployar solo.

---

## 👥 Usuarios y permisos

Hay **dos roles**:

| | **Administrador** | **Odontólogo** |
|---|---|---|
| Registrar tratamientos, marcar envases/descartes | ✅ | ✅ |
| Anotar en la lista de reposición | ✅ | ✅ |
| Ver el tablero de inicio | ✅ | ✅ |
| Hacer el conteo / reconciliación | ✅ | ❌ |
| Armar el pedido del mes | ✅ | ❌ |
| Editar la lista de insumos, tratamientos, instrumental, config | ✅ | ❌ |
| Gestionar usuarios | ✅ | ❌ |

Los permisos los aplica la **base de datos (RLS)**, no solo la interfaz: aunque un odontólogo intente saltear la app, no puede tocar lo que no le corresponde.

### Cómo darle acceso a cada doctor

1. **Supabase → Authentication → Users → Add user**: creá su email + contraseña (marcá **"Auto Confirm"**).
2. En la app (como admin) → **Más → Usuarios y permisos**: el doctor aparece como **Odontólogo**. Tocá **Editar** y ponele el nombre (ej. "Dra. Martínez") y el rol.
3. Pasale a ese doctor su **email y contraseña**. Cada uno entra con lo suyo.

> El primero que hace el conteo y el pedido debería ser **Administrador**; los demás, **Odontólogo**.

---

## 📱 Cómo lo usan en el consultorio

- **Entrar:** cada doctor con su propio email + contraseña. Conviene guardar la URL como acceso directo en la pantalla de inicio del celular.
- **Diario (cada profesional):** pestaña **Registrar** → tocar el tratamiento (descuenta la receta solo). Marcar envases de granel vaciados y fresas/limas descartadas.
- **Semanal → quincenal (el admin):** pestaña **Conteo** → recorrer cajón por cajón y anotar lo real. El sistema ajusta el stock y muestra las diferencias.
- **Mensual (el admin):** pestaña **Pedido** → arma la lista para la clínica (imprimir o copiar).

### Cargar los datos reales

Vienen datos de **ejemplo**. Para poner los reales, entrá a **Más**:
Insumos · Tratamientos · Instrumental · Configuración (profesionales y cajones).
No hace falta tocar código.

**Familias:** `A` discreto (guantes, agujas, carpules…) · `B` granel, por envase (resina, hipoclorito…) · `C` instrumental (espejos, pinzas…).

---

## 💻 Desarrollo local (opcional)

```bash
cp .env.local.example .env.local   # y completá con tus claves de Supabase
npm install
npm run dev                        # http://localhost:3000
```

---

## 🔒 Seguridad y notas

- **Nunca** subas el archivo `.env.local` ni tus claves al repo (ya está en `.gitignore`).
- El acceso a los datos está protegido por **RLS**: sin login, no se ve nada.
- La lógica sensible (descuento por receta, conteo) corre en **funciones de la base de datos**, de forma atómica.
- **Versión de Next.js:** se usa `14.2.x` (la última estable de esa línea). `npm audit` marca avisos que corresponden a un salto a Next 16 (cambio mayor); la mayoría son sobre funciones que esta app no usa (optimización de imágenes, i18n) y que además Vercel mitiga. Si más adelante querés actualizar a Next 15/16, hay que ajustar el manejo de cookies del servidor.

## 🗂️ Estructura

```
app/            páginas (login, home) y estilos
components/     interfaz (AppShell, vistas, modales)
lib/            supabase (clientes), datos y acciones
supabase/       schema.sql (estructura) y seed.sql (ejemplo)
middleware.js   protección de rutas por login
_version-local-anterior/   primera versión local (referencia, no se usa)
```
