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