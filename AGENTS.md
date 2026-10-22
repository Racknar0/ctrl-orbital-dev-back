# Directrices del Agente (Backend)

## Stack y restricciones de entorno
- Node.js, TypeScript estricto, Prisma ORM y arquitectura modular.
- No instalar dependencias ni modificar `package.json` sin autorización explícita.
- No refactorizar código fuera del alcance de la tarea.
- No crear carpetas, archivos placeholder ni `.gitkeep` vacíos.
- Sangría estricta de 2 espacios (sin tabs) en todo el código fuente.

## Estructura y organización
- Árbol base:
  ```text
  src/
    controllers/    # Controladores HTTP y manejo de req/res
    middlewares/    # Validaciones, autenticación y control de acceso
    routes/         # Definición y enrutamiento de endpoints
    services/       # Lógica de negocio y transacciones
    utils/          # Utilidades auxiliares
    app.ts          # Configuración de Express y middlewares globales
    server.ts       # Arranque del servidor HTTP
  prisma/           # Esquema de base de datos y migraciones
  seed/             # Scripts de población inicial de datos
  uploads/          # Archivos y recursos multimedia subidos
  ```

## Despliegue de producción
- El VPS de Orbital Ctrl publica desde `master` con los comandos `u_back_ctrl` y `u_front_ctrl`, ejecutados con privilegios de administrador del VPS.
- Para cambios del backend, usa `u_back_ctrl`; para cambios del frontend, usa `u_front_ctrl`. Cada comando despliega únicamente su servicio y reinicia únicamente su proceso PM2 correspondiente.
- Los comandos toman el último commit de GitHub en `master`. Los cambios deben estar commiteados y subidos antes de desplegar; no despliegues trabajo local sin publicar.
- El backend genera Prisma Client, compila y aplica migraciones pendientes antes de activar la release. Los comandos conservan releases anteriores y revierten el enlace estable si falla el chequeo de salud.
- No hagas `git pull`, compilaciones ni cambios de symlink directamente dentro de `/opt/orbital-ctrl/back` o `/opt/orbital-ctrl/front`; son rutas estables administradas por el despliegue.
- No muestres, sobrescribas ni subas los `.env` de producción. Si el acceso SSH o los comandos no están disponibles, informa el bloqueo y no simules un despliegue.

## Documentación de modelos (obligatorio)
- Todos los modelos y enums de Prisma deben llevar comentarios de documentación `///` en español que expliquen su función en el negocio. Documenta también sus campos, relaciones y valores de enums, aclarando permisos, estados, datos sensibles y reglas de conservación o eliminación cuando corresponda.
- Al crear o modificar un modelo, actualiza sus comentarios en el mismo cambio. Deben describir el comportamiento implementado; no presentar funcionalidades futuras como si ya existieran.

## Cambios de modelos y migraciones (obligatorio)
- Cada cambio en modelos o en `prisma/schema.prisma` debe incluir una migración nueva y versionada en `prisma/migrations/`, en el mismo cambio de código. Nunca despliegues un cambio de esquema sin su migración.
- En desarrollo, genera y aplica la migración con `npm run db:migrate -- --name nombre_descriptivo` y luego ejecuta `npm run db:generate`. Revisa el SQL generado antes de confirmar los cambios.
- No uses `prisma db push` para cambios del proyecto y nunca edites o elimines una migración que ya pudo aplicarse en una base compartida; crea otra migración correctiva.
- Diseña migraciones para conservar los datos: para columnas obligatorias, renombres o cambios de formato, usa pasos compatibles que permitan rellenar o transformar los datos antes de imponer restricciones. Evalúa cuidadosamente cualquier `DROP`, truncado o pérdida de información.
- Incluye en el mismo commit el esquema, la migración y el código que depende de ella. El comando `u_back_ctrl` rechaza cambios de esquema sin una migración nueva, valida que no se hayan editado migraciones anteriores, guarda y verifica un respaldo de PostgreSQL antes de aplicar migraciones nuevas y ejecuta `prisma migrate deploy`. Los respaldos automáticos se identifican con `auto-pre-migration_<nombre_de_migracion>_<fecha>_<commit>.dump`.
- Solo tras una migración y un chequeo de salud exitosos, `u_back_ctrl` elimina los respaldos automáticos de migración con más de 7 días. Si el despliegue falla, los conserva. No borra respaldos manuales ni el respaldo inicial.
- El respaldo permite recuperar datos, pero no se restaura automáticamente al revertir código; prioriza migraciones aditivas y compatibles con la versión anterior de la aplicación.
