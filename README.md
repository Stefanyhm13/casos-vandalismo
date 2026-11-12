# Casos Vandalismo

> **Para ejecutarlo:** abre una terminal en esta carpeta y escribe `npm.cmd run dev`
> (en PowerShell de este equipo  a secas no funciona; en otras terminales sí).
> Luego entra a http://localhost:5173. Para detenerlo, `Ctrl + C`.

Aplicación web para registrar y hacer seguimiento a los casos de vandalismo. Reemplaza el Excel
compartido: varias personas pueden trabajar al mismo tiempo y cada área solo modifica su parte.

- **Interfaz:** React + Vite (JavaScript)
- **Servidor:** Node.js + Express
- **Base de datos:** MySQL 8 (o MariaDB 10.4 en adelante)

## Requisitos

- [Node.js](https://nodejs.org) versión 22.13 o superior (se recomienda la LTS actual).
- Un servidor MySQL 8.0.13 o superior y un usuario con permisos sobre la base de datos de la app.

## Puesta en marcha

```bash
npm install
```

Copiar `.env.example` como `.env` y escribir los datos de conexión a MySQL (servidor, usuario,
contraseña y nombre de la base). Al iniciar, la app crea sola las tablas; también crea la base de
datos si el usuario tiene permiso, y si no, hay que pedir que la creen vacía.

Si ya había datos en la versión anterior (archivo SQLite `data/casos.db`), pasarlos a MySQL una sola vez:

```bash
npm run migrar-mysql
```

Cargar los casos, operadores y buses del Excel (una sola vez):

```bash
npm run importar -- "ruta/Datos Atención Vandalismo.xlsx"
```

Compilar la interfaz e iniciar:

```bash
npm run build
```

```bash
npm start
```

La app queda en `http://localhost:3000`. Para que los demás la usen, se deja corriendo en un equipo
o servidor de la red y entran desde el navegador con `http://IP-DEL-EQUIPO:3000`.

Para desarrollar (recarga automática, interfaz en `http://localhost:5173`):

```bash
npm run dev
```

## Usuarios y roles

La primera vez se crean estos usuarios con la contraseña temporal `Vandalismo2026`
(el sistema obliga a cambiarla en el primer ingreso):

| Usuario      | Rol                   | Qué puede modificar                                              |
| ------------ | --------------------- | ----------------------------------------------------------------- |
| `admin`    | Administrador         | Todo. Crea usuarios, restablece contraseñas y elimina casos      |
| `pesv`     | PESV Administrativo   | Crea casos. Datos de la novedad, del tercero, policía y denuncia |
| `cmo`      | Profesional CMO       | Atención del CMO                                                 |
| `sies24`   | SIES24                | Análisis SIES24 (incluye el estado del caso)                     |
| `juridico` | Profesional Jurídico | Gestión jurídica                                                |

Existe además el rol **Solo consulta**. Todos los roles ven el caso completo; lo que no les
corresponde aparece bloqueado. El permiso se valida también en el servidor.

El administrador crea un usuario por persona desde el menú **Usuarios**.

## Reglas de los datos

- Ningún campo es obligatorio.
- El caso se identifica con un ID automático (`CV-0001`). Se puede buscar por ID, código o documento del operador.
- Código del operador: solo números, 4 dígitos; si se escriben menos, se completa con ceros (`799` → `0799`).
- Documentos: solo números.
- Al escribir el código o el documento del operador se completan los otros datos y el nombre.
  Se buscan en la base Reportes de la empresa (datos `MSSQL_*` del `.env`); el listado importado
  del Excel queda de respaldo para los operadores retirados o si ese servidor no responde.
- Al escribir el número del bus se completa la placa desde el listado importado del Excel.
- Todo lo que se completa solo se puede corregir a mano.
- Cada cambio queda en el historial del caso con usuario y fecha.

## Dónde cambiar cosas

- `shared/campos.js`: roles, secciones, campos y listas desplegables. Agregar un campo ahí lo crea
  en el formulario y en la base de datos.
- `src/estilos.css`: colores (variables al inicio del archivo).
- `public/icono.svg`: ícono de la app.

## Respaldo

Toda la información está en la base de datos MySQL: el respaldo se hace con `mysqldump` o con la
copia de seguridad que ya tenga el servidor MySQL de la empresa. El archivo `.env` (contraseña de
MySQL) y la carpeta `data/` no se suben a GitHub.

## Power BI

En Power BI: **Obtener datos → Base de datos MySQL**, con el servidor y la base del archivo `.env`.
Conviene usar un usuario de MySQL de solo lectura y cargar las tablas `casos` e `historial`
(no `usuarios` ni `sesiones`). Las fechas de los campos (`fecha_novedad`) están guardadas como
texto `AAAA-MM-DD`; en Power BI se cambian a tipo Fecha. `creado_en` ya es de tipo fecha y hora.

Variables del archivo `.env`: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`,
`MYSQL_DATABASE` y, opcionales, `PORT` (puerto de la app) y `CLAVE_INICIAL` (contraseña temporal).
