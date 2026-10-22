# Backend de App Gastos

API inicial en TypeScript con Express, variables de entorno y Prisma para PostgreSQL.

## Inicio

```sh
npm install
npm run dev
```

Copia `.env.example` a `.env`, configura `DATABASE_URL` y reemplaza `JWT_SECRET` por un secreto aleatorio de al menos 32 caracteres. Puedes generarlo con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

La comprobación inicial queda disponible en `GET http://localhost:4000/api/health`.

## Estructura

```text
src/
  controllers/auth/ # Controladores de autenticación
  middlewares/      # Manejo de errores, 404 y autenticación
  routes/auth/      # Rutas de autenticación
  services/auth/    # Registro, login y tokens
  utils/            # Cliente de Prisma
prisma/           # Esquema y seed
uploads/          # Archivos locales ignorados por Git
```

## Base de datos

El registro crea una cuenta pendiente de verificación y un primer espacio de trabajo. El esquema inicial está en `prisma/schema.prisma`:

```sh
npm run db:generate
npm run db:migrate
npm run db:studio
```

`db:migrate` crea las tablas al conectarse a PostgreSQL. Para iniciar la API, ejecuta `npm run dev`.

Rutas de acceso: `POST /api/auth/register`, `POST /api/auth/verify-email`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` y `GET /api/auth/me` (requiere Bearer token). Las cuentas nuevas deben verificar el correo antes de iniciar sesión; las cuentas existentes se conservan verificadas por la migración.

## Correo con Gmail

Completa en `.env` `SMTP_USER` con la cuenta Gmail y `SMTP_PASS` con su App Password. La cuenta debe tener verificación en dos pasos habilitada. `SMTP_FROM` es opcional y, si queda vacío, se usa `SMTP_USER`. No uses la contraseña normal de Gmail. En producción, cambia `APP_URL` a la URL pública de la aplicación.

## Dependencias por prioridad

- **Base:** Express para la API, dotenv para configuración local y CORS para permitir el frontend.
- **Persistencia:** Prisma y su cliente para conectar PostgreSQL. Los modelos del negocio se agregan cuando se definan.
- **Desarrollo:** tsx recarga el servidor durante el desarrollo y TypeScript compila la aplicación.
- **Tipos:** TypeScript y `@types/express`, `@types/cors` y `@types/node` cubren los tipos del servidor. No se creó `src/types` porque aún no hay tipos propios.
- **Autenticación:** bcrypt para hashes de contraseña, JWT para sesiones y Nodemailer/SMTP para verificación de correo y recuperación de contraseña.
- **Para después:** Multer si se habilitan cargas de archivos; Sharp o PDFKit si se necesitan imágenes o documentos.

Los tokens de acceso se guardan en `sessionStorage` en el navegador durante esta primera integración.

## Salas rápidas locales

La migración `20261024000000_add_quick_rooms` agrega salas, participantes invitados, gastos, repartos y pagos. No vincula las salas a cuentas ni espacios de trabajo.

- Las salas permiten actividad durante 30 días; después quedan en consulta. El organizador puede cerrarlas antes. No hay eliminación automática de salas en esta fase.
- El acceso requiere una credencial de invitado por sala en `X-Room-Token`; el código de invitación permite unirse, pero no suplantar una participación existente.
- Los importes se guardan como `Decimal(14,2)` y se reparten en centavos exactos entre los participantes seleccionados. Quienes se unan después no alteran los repartos anteriores.
- Solo el autor de un gasto o el organizador puede corregirlo/eliminarlo antes de reportar pagos. Se pueden agregar gastos nuevos después de pagar. Los pagos confirmados son definitivos en esta fase.
- Los datos para recibir transferencias son opcionales y visibles para los participantes. Las transferencias y su confirmación son manuales.

API base: `/api/quick-rooms`. `POST /` crea una sala; `POST /:code/join` incorpora un invitado; `GET /:code` consulta la sala; `PATCH /:code/me` actualiza el perfil; `POST /:code/close` cierra la sala. Los recursos `/:code/expenses` y `/:code/payments` permiten registrar gastos y pagos. La recepción se confirma con `POST /:code/payments/:id/confirm`.

### Pruebas de integración

```sh
npm run test:salas-rapidas
```

Compila y ejecuta ocho casos con HTTP real, PostgreSQL y `node:test`: creación/validación, privacidad e identidad por sala, reparto exacto e ingreso posterior, edición/eliminación, pagos concurrentes y confirmación, cancelación/cierre, vencimiento/CORS y límite de intentos. Inicia su propia API en un puerto libre y elimina únicamente las salas creadas por la suite. Por protección, solo acepta `app_gastos` en PostgreSQL local; requiere las migraciones aplicadas.
