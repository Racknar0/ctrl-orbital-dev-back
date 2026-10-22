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

El registro crea una cuenta y un primer espacio de trabajo. El esquema inicial está en `prisma/schema.prisma`:

```sh
npm run db:generate
npm run db:migrate
npm run db:studio
```

`db:migrate` crea las tablas al conectarse a PostgreSQL. Para iniciar la API, ejecuta `npm run dev`.

Rutas de acceso: `POST /api/auth/register`, `POST /api/auth/login` y `GET /api/auth/me` (requiere Bearer token). El registro y login usan correo y contraseña; verificación de correo, recuperación de contraseña y proveedores sociales quedan pendientes.

## Dependencias por prioridad

- **Base:** Express para la API, dotenv para configuración local y CORS para permitir el frontend.
- **Persistencia:** Prisma y su cliente para conectar PostgreSQL. Los modelos del negocio se agregan cuando se definan.
- **Desarrollo:** tsx recarga el servidor durante el desarrollo y TypeScript compila la aplicación.
- **Tipos:** TypeScript y `@types/express`, `@types/cors` y `@types/node` cubren los tipos del servidor. No se creó `src/types` porque aún no hay tipos propios.
- **Autenticación:** bcrypt para hashes de contraseña y JWT para sesiones. La verificación de correo, recuperación de contraseña y proveedores sociales se pueden añadir luego.
- **Para después:** Multer si se habilitan cargas de archivos; Sharp/PDFKit o nodemailer solo cuando se necesiten esas funciones.

Los tokens de acceso se guardan en `sessionStorage` en el navegador durante esta primera integración.
