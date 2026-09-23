# 🛡️ Guía de Seguridad y Despliegue — Liliana Salon

Este documento detalla las directrices de seguridad, arquitectura de autenticación y autorización con Firebase, configuración de variables de entorno y los pasos operativos para administradores y desarrolladores de **Liliana Salon**.

---

## 1. Arquitectura de Seguridad Implementada

El proyecto ha sido sometido a una auditoría y remediación técnica integral contra vulnerabilidades de *Broken Access Control*, *Privilege Escalation*, manipulación de precios/inventario y exposición de datos.

### Principales protecciones activas:
1. **Reglas de Mínimo Privilegio en Firestore (`firestore.rules`):**
   - Eliminación total de comodines permisivos (`allow read, write: if true;`).
   - El catálogo (`products`) y la configuración (`settings`) tienen lectura pública y **escritura exclusiva para administradores**.
   - Los perfiles de usuario (`users`) solo pueden ser leídos por su dueño o por el personal administrativo. El cliente **no puede modificar** `role`, `admin`, `points`, `firstPurchaseUsed` ni `discountUsed`.
   - Los pedidos (`orders`) son de lectura exclusiva del cliente comprador o del administrador. Los clientes **no pueden alterar** el total, estado (`status`), descuento ni puntos.
   - Denegación explícita por defecto (`allow read, write: if false;`).

2. **Reglas de Almacenamiento en Firebase Storage (`storage.rules`):**
   - Lectura pública en imágenes de catálogo (`/products/**`).
   - Escritura y eliminación restringidas exclusivamente a administradores verificados.
   - Validación estricta de tamaño máximo (5 MB) y tipo MIME permitido (`image/jpeg`, `image/png`, `image/webp`).

3. **Autenticación y Autorización basada en Custom Claims:**
   - La autorización de administradores depende exclusivamente de la presencia del claim criptográfico `{ admin: true }` en el Firebase ID Token (`request.auth.token.admin == true`).
   - Se eliminaron por completo las comprobaciones inseguras basadas en subcadenas de correo (`email.includes("admin")` o `email.includes("liliana")`).
   - Se eliminó el botón público de *"Registrar primer administrador"*.

4. **Validación y Recálculo de Pedidos en Servidor (`/api/orders`):**
   - El cliente envía únicamente IDs de producto y cantidades.
   - El servidor de Next.js consulta los precios oficiales y existencias en Firestore, valida la elegibilidad del cupón de bienvenida (15% en el producto de mayor valor si la cuenta no lo ha utilizado) y calcula el total exacto.

5. **Transacciones Atómicas e Idempotencia en Inventario (`/api/admin/orders/[id]/complete`):**
   - Confirmar un pedido ejecuta una transacción atómica de Firestore (`runTransaction`).
   - Se valida que `status !== "completada"`. Si ya fue completado, no se vuelve a descontar inventario ni se duplican puntos.
   - Se evita stock negativo validando cantidades disponibles.
   - Se quema el cupón de bienvenida (`firstPurchaseUsed: true`), se acreditan puntos de lealtad al cliente y se genera un registro inmutable en `auditLogs`.

6. **Cabeceras de Seguridad HTTP y Content-Security-Policy (CSP):**
   - Configuración en `next.config.ts` con protección contra Clickjacking (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), Sniffing de tipos MIME (`nosniff`), HSTS y Permissions-Policy.

---

## 2. Variables de Entorno Requeridas

Copia `.env.example` a `.env.local` en tu entorno de desarrollo o configúralas en la consola de tu proveedor de hosting (ej. Vercel):

### Variables Públicas del Cliente (Prefijo `NEXT_PUBLIC_`)
| Variable | Descripción | Ejemplo |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Llave API de Firebase Web Client | `AIzaSyA...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Dominio de autenticación de Firebase | `liliana-salon.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Identificador del proyecto de Firebase | `liliana-salon` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket de almacenamiento | `liliana-salon.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID para notificaciones | `570754067993` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID de Firebase Web | `1:570754067993:web:...` |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | *(Opcional)* Clave de sitio para App Check | `6Lf...` |

### Variables Privadas del Servidor (NUNCA exponer en cliente ni subir a Git)
| Variable | Descripción |
|---|---|
| `FIREBASE_PROJECT_ID` | `liliana-salon` |
| `FIREBASE_CLIENT_EMAIL` | Correo de la cuenta de servicio (ej. `firebase-adminsdk-xxxxx@...`) |
| `FIREBASE_PRIVATE_KEY` | Clave privada RSA PEM de la cuenta de servicio (incluyendo cabeceras `-----BEGIN PRIVATE KEY-----`) |

---

## 3. Cómo Crear o Asignar una Cuenta de Administrador

Para garantizar que nadie pueda autoasignarse permisos desde la web, los administradores se configuran exclusivamente mediante el script seguro de consola que utiliza Firebase Admin SDK:

### Paso a Paso:
1. Crea primero la cuenta del administrador en la página normal de registro o desde Firebase Console (Authentication > Users > Add user) con su correo y contraseña.
2. Abre tu terminal en la raíz del proyecto.
3. Ejecuta el comando administrativo:
   ```bash
   npm run set-admin -- tu_correo_admin@lilianasalon.com
   ```
   *(También puedes pasar el UID del usuario en lugar del correo).*
4. El script asignará el Custom Claim `{ admin: true }` y sincronizará su perfil en Firestore.
5. Inicia sesión en: `https://liliana-salon.vercel.app/admin/login` (o en `http://localhost:3000/admin/login`).

### Para revocar privilegios de administrador:
```bash
npm run set-admin -- remove tu_correo_admin@lilianasalon.com
```

---

## 4. Despliegue de Reglas de Seguridad en Firebase

Asegúrate de tener instalada y autenticada la CLI oficial de Firebase (`firebase login`):

### 1. Desplegar Reglas de Firestore
```bash
npx -y firebase-tools@latest deploy --only firestore:rules
```

### 2. Desplegar Reglas de Storage
```bash
npx -y firebase-tools@latest deploy --only storage
```

### 3. Desplegar Ambas a la vez
```bash
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

---

## 5. Configuración de Firebase App Check (Paso Manual)

Para proteger Firestore y Storage contra solicitudes automáticas no autorizadas o scraping:

1. Ve a [Firebase Console](https://console.firebase.google.com/) > **App Check**.
2. Registra tu aplicación web seleccionando el proveedor **reCAPTCHA Enterprise** (o reCAPTCHA v3).
3. Obtén la clave del sitio (Site Key) y colócala en tu variable de entorno:
   ```env
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY="tu_site_key_aqui"
   ```
4. En Firebase Console, haz clic en **Firestore Database** > App Check y asegúrate de verificar las métricas antes de activar el modo de forzado (*Enforce*).

---

## 6. Rotación de Credenciales de Firebase Admin

Si necesitas regenerar las credenciales del servidor:
1. Dirígete a **Firebase Console** > Configuración del Proyecto > **Cuentas de servicio** (*Service accounts*).
2. Haz clic en **Generar nueva clave privada**.
3. Copia el `client_email` y el `private_key` del archivo JSON descargado.
4. Actualiza las variables `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` en tu panel de Vercel.
5. Elimina la clave antigua en Firebase Console para invalidarla inmediatamente.

---

## 7. Checklist de Verificación de Producción

- [x] Reglas de Firestore desplegadas sin `allow read, write: if true;`.
- [x] Reglas de Storage desplegadas con validación de tipo MIME y tamaño máximo de 5MB.
- [x] No existen contraseñas ni tokens hardcodeados en el código fuente.
- [x] Los endpoints administrativos verifican Custom Claims mediante `verifyAdminAuthToken`.
- [x] Los pedidos calculan y validan precios en servidor con Zod.
- [x] Transacciones atómicas e idempotentes para la confirmación de pedidos.
- [x] Variables de entorno privadas configuradas en Vercel.
- [x] Headers de seguridad y Content-Security-Policy (CSP) activos en `next.config.ts`.
