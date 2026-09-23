# Liliana Salon — Cuidado Capilar Profesional

Plataforma de e-commerce y catálogo oficial de **Liliana Salon** para Guatemala (GTQ) y El Salvador (USD). Desarrollada con Next.js 16 (App Router), React 19, Tailwind CSS, Firebase Authentication y Cloud Firestore.

---

## 🔒 Seguridad y Configuración

El proyecto cuenta con una auditoría y remediación técnica de seguridad integral. Para consultar el modelo de permisos, despliegue de reglas de Firestore y Storage, y configuración de variables de entorno:

👉 **[Consulta la Guía Completa de Seguridad (SECURITY.md)](./SECURITY.md)**

### Comandos de Seguridad Clave:
```bash
# Asignar permisos de administrador a un usuario
npm run set-admin -- admin@lilianasalon.com

# Ejecutar verificación de reglas de seguridad
npx tsx scripts/test-rules.ts

# Desplegar reglas a Firebase
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

---

## Comenzando

Ejecuta el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

Para acceder al panel administrativo: [http://localhost:3000/admin](http://localhost:3000/admin).

---

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo.
- `npm run build`: Compila la aplicación para producción.
- `npm run start`: Inicia el servidor de producción.
- `npm run lint`: Ejecuta el análisis de linter ESLint.
- `npm run set-admin`: Asigna Custom Claim `{ admin: true }` a una cuenta.
