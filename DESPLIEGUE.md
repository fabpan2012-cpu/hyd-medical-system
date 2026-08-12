# Guía de Despliegue — H&D Medical Insumos

Esta guía monta el sistema en internet usando **Render** (para el backend/API,
gratis) y **Netlify** (para el frontend, que ya tienes). Al terminar tendrás una
URL pública que cualquiera de tu equipo puede abrir desde el celular, tablet o
computador.

No necesitas saber programar para seguir estos pasos — son formularios y botones.

---

## Antes de empezar

Vas a necesitar una cuenta gratuita en:
- **GitHub** (https://github.com) — ahí vive el código para que Render y Netlify lo lean.
- **Render** (https://render.com) — puedes crear la cuenta con tu mismo usuario de GitHub.
- **Netlify** — ya la tienes.

---

## PARTE 1 — Subir el código a GitHub

1. Entra a https://github.com y crea una cuenta si no tienes (botón "Sign up").
2. Ya adentro, haz clic en el botón verde **"New"** (o el "+" arriba a la derecha → "New repository").
3. Nombra el repositorio, por ejemplo: `hyd-medical-system`. Déjalo en **Public** o **Private** (cualquiera funciona). No marques ninguna otra opción. Clic en **"Create repository"**.
4. En la página que aparece, busca el enlace que dice **"uploading an existing file"** (o el botón "Add file" → "Upload files").
5. Descomprime en tu computador el archivo `hyd-medical-system.zip` que te entregué. Vas a ver dos carpetas: `backend` y `frontend`, más el `README.md`.
6. Arrastra **todo el contenido** de la carpeta descomprimida (las carpetas `backend`, `frontend` y el archivo `README.md`) a la página de GitHub donde dice "Drag files here to add them to your repository".
7. Abajo, en "Commit changes", deja el mensaje por defecto y haz clic en **"Commit changes"**.

Listo: tu código ya está en GitHub y Render/Netlify podrán leerlo desde ahí.

---

## PARTE 2 — Publicar el Backend (API) en Render

1. Entra a https://render.com y crea tu cuenta (puedes usar "Sign up with GitHub" para que quede conectado automáticamente).
2. En el panel principal, clic en **"New +"** → **"Web Service"**.
3. Conecta tu cuenta de GitHub si te lo pide, y selecciona el repositorio `hyd-medical-system` que creaste en la Parte 1.
4. Render te va a mostrar un formulario. Complétalo así:
   - **Name**: `hyd-backend` (o el nombre que quieras, será parte de tu URL)
   - **Region**: la más cercana a Colombia (Ohio o Oregon suelen ser las disponibles gratis)
   - **Root Directory**: `backend`  ⚠️ este campo es importante, indica que solo use esa carpeta
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Instance Type**: `Free`
5. Antes de crear, busca la sección **"Environment Variables"** (o "Advanced" → "Add Environment Variable") y agrega:
   - `JWT_SECRET` → escribe una frase larga y aleatoria, por ejemplo: `hd-medical-2026-clave-secreta-no-compartir-xyz789`
   - `PORT` → `4000`
6. Clic en **"Create Web Service"**.
7. Render va a instalar todo y arrancar el servidor (tarda 2-5 minutos la primera vez). Cuando el estado diga **"Live"** con un punto verde, copia la URL que te asigna arriba, algo como:
   `https://hyd-backend.onrender.com`

   Esa es la dirección de tu API. Puedes probarla pegando en el navegador:
   `https://hyd-backend.onrender.com/api/health` — debe mostrarte un mensaje `{"status":"ok",...}`.

**Nota sobre el plan gratuito de Render**: si el backend no recibe visitas por 15 minutos, se "duerme" y la próxima petición tarda ~30-50 segundos en despertar. Es normal y no afecta los datos, solo la primera carga del día. Cuando el negocio dependa de esto a diario, conviene pasar al plan pago más económico (~US$7/mes) para que esté siempre despierto.

---

## PARTE 3 — Publicar el Frontend en Netlify

1. Entra a tu cuenta de Netlify.
2. Clic en **"Add new site"** → **"Import an existing project"**.
3. Elige **"Deploy with GitHub"** y autoriza el acceso si te lo pide.
4. Selecciona el repositorio `hyd-medical-system`.
5. En la configuración de build, completa:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
6. Antes de desplegar, busca **"Environment variables"** (o después en Site settings → Environment variables) y agrega:
   - `VITE_API_BASE_URL` → la URL de tu backend de Render **seguida de `/api`**, ej: `https://hyd-backend.onrender.com/api`

   *(Este paso conecta el frontend con el backend. Si más adelante cambias de proveedor de backend, solo actualizas este valor y vuelves a desplegar.)*
7. Clic en **"Deploy site"**. Netlify instalará y compilará (1-3 minutos).
8. Cuando termine, te da una URL como `https://algo-al-azar.netlify.app`. Esa ya es tu sistema funcionando — ábrela desde el celular o el computador y deberías ver la pantalla de login con el logo de H&D.

### Nota técnica (ya resuelta, no requiere que hagas nada)

Dejé listo un archivo `frontend/public/_redirects` que evita un error común en Netlify:
sin él, si alguien refresca el navegador estando en una pantalla como "Terceros",
vería un error 404 en vez de la aplicación. Ya viene incluido en el proyecto, no
necesitas configurarlo.

---

## PARTE 4 — Darle un nombre más amigable (opcional)

Tanto Render como Netlify permiten cambiar el subdominio gratis:
- En Netlify: **Site settings → Domain management → Options → Edit site name**. Puedes poner algo como `hd-medical-insumos.netlify.app`.
- Si más adelante quieres usar tu propio dominio (ej. `sistema.hdmedicalinsumos.co`), ambos servicios permiten conectarlo gratis desde la misma sección ("Add custom domain"), apuntando un registro DNS desde donde tengas contratado el dominio `hdmedicalinsumos.co`.

---

## PARTE 5 — Primer ingreso

1. Abre la URL de Netlify.
2. Ingresa con el usuario `admin` y la contraseña `Admin#2026` (ver README para el resto de usuarios de prueba).
3. **Primero que nada**: ve a "Usuarios y Roles" y cambia esa contraseña, o crea los usuarios reales de tu equipo con sus propias contraseñas, y desactiva/borra los de prueba.

---

## Resumen del flujo de actualización futura

Cada vez que yo te entregue una mejora o corrección de código:
1. Subes los archivos actualizados a tu repositorio de GitHub (reemplazando los anteriores, igual que en la Parte 1).
2. Render y Netlify detectan el cambio automáticamente y vuelven a publicar solos — no tienes que repetir toda la configuración, solo esperar unos minutos a que digan "Live" / "Published" de nuevo.

Si en algún momento quieres que te deje instrucciones más detalladas para conectar el repositorio a Git normal (con línea de comandos) en vez de subir archivos manualmente, dímelo y te preparo esa alternativa también.
