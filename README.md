# Casos Vandalismo

Aplicación web para registrar y hacer seguimiento a los casos de vandalismo. Reemplaza el Excel
compartido: varias personas trabajan al mismo tiempo y cada área solo modifica su parte.

- **Interfaz:** React + Vite (JavaScript)
- **Servidor:** Node.js + Express
- **Base de datos:** MySQL 8 (o MariaDB 10.4 en adelante)
- **Consulta de operadores:** base Reportes de la empresa (SQL Server, solo lectura, opcional)
- **Avisos por correo:** servidor SMTP de la empresa (opcional)

> **Para ejecutarla en el equipo de desarrollo:** `npm.cmd run dev` y entrar a http://localhost:5173.
> Se detiene con `Ctrl + C`. (En PowerShell de ese equipo hay que escribir `npm.cmd`; en otras terminales basta `npm`.)

npm.cmd run dev

## Contenido

1. [Instalación en el servidor](#instalación-en-el-servidor)
2. [Pasar los datos a MySQL](#pasar-los-datos-a-mysql)
3. [Archivo `.env`](#archivo-env)
4. [Usuarios y roles](#usuarios-y-roles)
5. [Cómo funciona](#cómo-funciona)
6. [Avisos por correo](#avisos-por-correo)
7. [Power BI](#power-bi)
8. [Respaldo](#respaldo)
9. [Dónde cambiar cosas](#dónde-cambiar-cosas)

## Instalación en el servidor

**Requisitos**

- [Node.js](https://nodejs.org) 22.13 o superior (se recomienda la LTS actual).
- Un servidor MySQL 8.0.13 o superior (o MariaDB 10.4+) y un usuario con permisos sobre la base de
  datos de la app (crear tablas, leer y escribir).
- Desde el servidor de la app debe haber conexión de red con: el MySQL; el SQL Server de la base
  Reportes (puerto 1433), si se va a usar; y el servidor de correo (SMTP), si se van a enviar avisos.

**Pasos**

1. Copiar la carpeta del proyecto al servidor (o clonar el repositorio) y, dentro de ella, instalar:

   ```bash
   npm install
   ```
2. Copiar `.env.example` como `.env` y escribir los datos de conexión (ver [Archivo `.env`](#archivo-env)).
   Lo único obligatorio es MySQL.
3. Crear la base de datos. La app crea sola todas las tablas la primera vez que arranca, y también
   la base si el usuario tiene permiso. Si no lo tiene, pedir que la creen vacía:

   ```sql
   CREATE DATABASE casos_vandalismo CHARACTER SET utf8mb4;
   ```
4. Cargar los datos (una sola vez): ver [Pasar los datos a MySQL](#pasar-los-datos-a-mysql).
5. Compilar la interfaz e iniciar:

   ```bash
   npm run build
   ```

   ```bash
   npm start
   ```

La app queda en `http://localhost:3000` (o el puerto de `PORT`). Las demás personas entran desde el
navegador con `http://IP-DEL-SERVIDOR:3000`; ese puerto debe estar permitido en el firewall.

Para que siga corriendo al cerrar la sesión o reiniciar el servidor, conviene dejarla como servicio
(por ejemplo con [PM2](https://pm2.keymetrics.io) o con NSSM en Windows) ejecutando `npm start` en
la carpeta del proyecto.

**Para actualizar a una versión nueva:** reemplazar el código, `npm install`, `npm run build` y
reiniciar la app. Las tablas y columnas que falten se crean solas al arrancar; los datos no se tocan.

## Pasar los datos a MySQL

Hay dos caminos. Se usa **solo uno**, una sola vez.

### A. Traer los datos que ya estaban en la versión anterior (SQLite)

Es el camino normal si la app ya se venía usando: conserva casos, historial, usuarios con sus
contraseñas, roles creados, operadores y buses.

1. Copiar el archivo `data/casos.db` del equipo donde estaba la app a la carpeta `data/` del
   servidor. (La carpeta `data/` no viaja en el repositorio porque tiene datos personales.)
2. Con el `.env` ya apuntando al MySQL del servidor, ejecutar:

   ```bash
   npm run migrar-mysql
   ```

   El comando crea las tablas, copia todo conservando los ID y al final compara cuántas filas
   quedaron en cada lado. Debe terminar con `Listo: MySQL quedó con los mismos datos que SQLite.`

- El archivo SQLite solo se lee: queda intacto como respaldo.
- Si MySQL ya tiene casos, el comando no hace nada. Para borrar lo que haya en MySQL y volver a
  copiar todo: `npm run migrar-mysql -- --reemplazar`.
- Si el archivo está en otra ruta, se indica con la variable `RUTA_DB`.
- Las sesiones abiertas no se copian: cada persona vuelve a ingresar con su misma contraseña.

### B. Empezar desde los Excel

Si no hay datos anteriores, se cargan los casos, los operadores y los buses desde los Excel:

```bash
npm run importar -- "ruta/Datos Atención Vandalismo.xlsx"
```

```bash
npm run importar-buses -- "ruta/Placas Unidad SAO6.xlsx"
```

Los operadores y los buses se actualizan cada vez que se ejecuta; los casos solo se cargan si la
base todavía no tiene ninguno (para no duplicarlos).

## Archivo `.env`

Está en la raíz del proyecto, no se sube a GitHub y se lee al arrancar. Después de cambiarlo hay
que reiniciar la app.

| Variable                                                                                 | Para qué sirve                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`   | **Obligatorio.** Base de datos de la app.                                                                                                            |
| `PORT`                                                                                 | Puerto de la app (por defecto 3000).                                                                                                                       |
| `CLAVE_INICIAL`                                                                        | Contraseña temporal de los usuarios nuevos (por defecto `Vandalismo2026`).                                                                              |
| `MSSQL_SERVER`, `MSSQL_PORT`, `MSSQL_USER`, `MSSQL_PASSWORD`, `MSSQL_DATABASE` | Opcional. Base **Reportes** (SQL Server) de donde salen el código, el documento y el nombre del operador. `MSSQL_DATABASE` debe ser `Reportes`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`            | Opcional. Servidor de correo para los avisos.                                                                                                              |
| `APP_URL`                                                                              | Opcional. Dirección con la que se entra a la app (ej.: `http://IP-DEL-SERVIDOR:3000`); con ella el correo lleva el enlace directo al caso.              |

Lo opcional se puede dejar sin llenar: la app funciona igual, sin esa función.

## Usuarios y roles

La primera vez (si no se migraron usuarios) se crean estos, con la contraseña temporal
`Vandalismo2026`; el sistema obliga a cambiarla en el primer ingreso:

| Usuario      | Rol                   | Qué puede modificar                                                 |
| ------------ | --------------------- | -------------------------------------------------------------------- |
| `admin`    | Administrador         | Todo. Crea usuarios y roles, restablece contraseñas y elimina casos |
| `pesv`     | PESV Administrativo   | Crea casos. Datos de la novedad, del tercero, policía y denuncia    |
| `cmo`      | Profesional CMO       | Atención del CMO                                                    |
| `sies24`   | SIES24                | Análisis SIES24 (incluye el estado del caso)                        |
| `juridico` | Profesional Jurídico | Gestión jurídica                                                   |

Existe además el rol **Solo consulta**. Todos los roles ven el caso completo; lo que no les
corresponde aparece bloqueado. El permiso se valida también en el servidor.

Desde el menú **Usuarios**, el administrador:

- crea un usuario por persona, con su rol y, si se quiere, su correo;
- cambia el rol o el correo, restablece la contraseña y activa o desactiva usuarios;
- crea roles nuevos: elige qué campos existentes puede editar el rol, le agrega campos propios
  (texto, número, fecha, hora o lista de opciones) y define si puede crear casos.

## Cómo funciona

**Lista de casos**

- Se busca por ID, código o documento del operador, nombre, placa o lugar, y se filtra por
  **año**, **mes**, estado y tipo de daño.
- **Exportar a Excel:** el botón abre un modo de selección. Se marcan los casos que se quieren
  (o "Seleccionar todos") y se exportan los marcados, o se exportan todos los de la lista con los
  filtros aplicados. El archivo trae una fila por caso con todos los campos, agrupados por sección,
  con encabezados fijos, filtros y las fechas como fechas de Excel.
- **Casos pendientes:** el aviso de arriba muestra los casos a los que les falta información que
  le corresponde a quien está viendo (al administrador, de cualquier área), cuántos campos faltan y
  **hace cuántos días** está pendiente. Los días se cuentan desde la fecha de creación del caso;
  en los casos que vinieron del Excel, esa fecha es la de la novedad.

**Casos**

- Ningún campo es obligatorio. El caso se identifica con un ID automático (`CV-0001`).
- **Campos vacíos → `N/A`:** al guardar, los campos que la persona puede diligenciar y deja vacíos
  quedan como `N/A` (no aplica). Los de otras áreas no se tocan: siguen pendientes para su
  responsable. Un `N/A` se puede cambiar después por el dato real.
  Ojo: el administrador puede editar todos los campos, así que cuando él guarda un caso, todos los
  vacíos quedan en `N/A` y el caso deja de aparecer como pendiente para las demás áreas.
- Código del operador: 4 dígitos; si se escriben menos, se completa con ceros (`799` → `0799`).
  Documentos: solo números.
- **Operador:** al escribir el código o el documento se completan los otros datos y el nombre.
  Se buscan primero en la base Reportes (vista `Sao_vw_ti_ParametrosPrepensionado`: `Empleado`,
  `Nombre`, `CodigoOperador`). El listado importado del Excel queda de respaldo para los operadores
  retirados (que en Reportes ya no traen código) y por si ese servidor no responde. La foto se
  muestra a partir del documento.
- **Bus:** al escribir el número o la placa se completa el otro dato desde el listado de buses.
- Todo lo que se completa solo se puede corregir a mano.
- La fecha y la hora se eligen con el calendario y el selector de hora de la app.
- Cada cambio queda en el historial del caso con usuario y fecha.

## Avisos por correo

Cada usuario puede tener un correo (menú **Usuarios**). Cuando se crea un caso, la app envía un
mensaje a los usuarios activos con correo que tienen algo por diligenciar (no a quien lo creó ni a
los de solo consulta), con el ID del caso, los datos básicos y el enlace para abrirlo.

Para activarlo se llenan los datos `SMTP_*` y `APP_URL` del `.env` y se reinicia la app. En el menú
**Usuarios** aparece entonces el botón **Enviar correo de prueba**, que envía un mensaje al correo
del administrador para comprobar la configuración. Si el servidor de correo falla, el caso se crea
igual y el error queda en el registro (consola) de la app.

## Power BI

En Power BI: **Obtener datos → Base de datos MySQL**, con el servidor y la base del `.env`
(la primera vez Power BI pide instalar el conector de MySQL).

- Conviene usar un usuario de MySQL de **solo lectura** y cargar las tablas `casos` e `historial`
  (no `usuarios` ni `sesiones`).
- Los campos de fecha (`fecha_novedad`) están guardados como texto `AAAA-MM-DD`; en Power BI se
  cambian a tipo Fecha. `creado_en` ya es de tipo fecha y hora.
- Los campos sin dato pueden venir vacíos o con el texto `N/A`. Al convertir una columna a Fecha o
  a número, esos valores dan error: se reemplazan los errores por *null* (Transformar → Reemplazar
  errores) o se reemplaza `N/A` por vacío antes de cambiar el tipo.

## Respaldo

Toda la información está en la base de datos MySQL: el respaldo se hace con `mysqldump` o con la
copia de seguridad que ya tenga el servidor MySQL de la empresa. El archivo `.env` (contraseñas) y
la carpeta `data/` no se suben a GitHub.

## Dónde cambiar cosas

- `shared/campos.js`: roles, secciones, campos y listas desplegables que vienen con la app. Un campo
  agregado ahí aparece en el formulario y su columna se crea sola en la base de datos.
- `server/index.js`: rutas del servidor (casos, usuarios, roles, exportación).
- `server/db.js`: conexión a MySQL y creación de tablas. `server/migrar-a-mysql.js`: copia desde SQLite.
- `server/reportes.js`: consulta de operadores en la base Reportes.
- `server/correo.js`: texto y envío de los correos. `server/exportar.js`: diseño del Excel.
- `src/componentes/`: pantallas de la app. `src/estilos.css`: colores (variables al inicio del archivo).
- `public/`: logo, ícono y fondo.
