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
3. Abrí el archivo [`supabase/schema.sql`](supabase/schema.sql), copiá **todo**, pegalo y apretá **Run**. Crea las tablas, la seguridad y las funciones.
4. Nueva query. Abrí [`supabase/seed.sql`](supabase/seed.sql), copiá todo, pegá y **Run**. Carga los datos de ejemplo.

### Paso 3 — Crear el usuario del consultorio

1. Menú lateral → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Poné un email (ej. `consultorio@tudominio.com`) y una contraseña. **Marcá "Auto Confirm User"** para que quede activo sin verificar el mail. Este es el login que van a compartir los 4.
3. (Recomendado) **Authentication → Sign In / Providers → Email**: desactivá **"Allow new users to sign up"**. Así nadie más puede crear cuentas.

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
4. Entrá a esa URL, logueate con el usuario del Paso 3. ¡Listo!

> Cada vez que hagas `git push`, Vercel vuelve a deployar solo.

---

## 📱 Cómo lo usan en el consultorio

- **Entrar:** todos usan el mismo email + contraseña del consultorio. Conviene guardar la URL como acceso directo en la pantalla de inicio del celular.
- **Diario (cada profesional):** pestaña **Registrar** → tocar el tratamiento (descuenta la receta solo). Marcar envases de granel vaciados y fresas/limas descartadas.
- **Semanal → quincenal (una persona):** pestaña **Conteo** → recorrer cajón por cajón y anotar lo real. El sistema reconcilia y muestra desvíos.
- **Mensual:** pestaña **Pedido** → arma la lista para la clínica (imprimir o copiar).

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
