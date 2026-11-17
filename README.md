# Casos Vandalismo

Aplicación web para registrar y hacer seguimiento a los casos de vandalismo del Sistema
Alimentador Oriental,varias personas trabajan al mismo tiempo y
cada perfil solo modifica su parte.

- **Interfaz:** React + Vite (JavaScript)
- **Servidor:** Node.js + Express
- **Base de datos de la app:** MySQL en el servidor de la empresa (ya creada y con los datos)
- **Consulta de operadores:** base Reportes de la empresa (SQL Server, solo lectura)
- **Avisos por correo:** servidor SMTP de la empresa (opcional, todavía no se incorpora)

> **Para probarla en el equipo de desarrollo:** `npm.cmd run dev` y entrar a http://localhost:5173.
> Se detiene con `Ctrl + C`. En PowerShell de ese equipo hay que escribir `npm.cmd`; en otras terminales basta `npm`.
>
> **Ojo:** el `.env` apunta a la base **real** del servidor de la empresa. Lo que se cree o se
> modifique al probar queda en esa base: los casos de prueba se deben eliminar después
> (el administrador puede hacerlo desde el caso, botón **Eliminar caso**).

## Contenido

1. [Dónde está cada cosa](#dónde-está-cada-cosa)
2. [Instalar o actualizar en el servidor](#instalar-o-actualizar-en-el-servidor)
3. [Archivo `.env`](#archivo-env)
4. [Usuarios y roles](#usuarios-y-roles)
5. [Cómo funciona](#cómo-funciona)
6. [Indicadores](#indicadores)
7. [Avisos por correo](#avisos-por-correo)
8. [Power BI](#power-bi)
9. [Respaldo](#respaldo)
10. [Carpetas y archivos del proyecto](#carpetas-y-archivos-del-proyecto)
11. [Cambios de esta versión](#cambios-de-esta-versión)

## Dónde está cada cosa

| Qué | Dónde |
| --- | --- |
| Base de datos de la app (MySQL) | Servidor MySQL de la empresa. Servidor, base, usuario y contraseña: variables `MYSQL_*` del `.env` |
| Base Reportes (SQL Server, solo lectura) | Servidor SQL Server de la empresa, base `Reportes`, vista `Sao_vw_ti_ParametrosPrepensionado`. Datos de conexión: variables `MSSQL_*` del `.env` |
| Fotos de los operadores | Servidor web de la empresa (la dirección está en `src/componentes/FotoOperador.jsx`). Las carga el navegador |
| Contraseñas y datos de conexión | Archivo `.env` en la raíz del proyecto. **No está en GitHub**: se entrega aparte (ver [Archivo `.env`](#archivo-env)) |

La base MySQL **ya existe y tiene todos los datos** (casos, historial, usuarios, roles, operadores y
buses). No hay que crearla ni migrar nada.

**Tablas de la base MySQL**

| Tabla | Qué guarda |
| --- | --- |
| `casos` | Un caso por fila. Cada campo del formulario es una columna (ver `shared/campos.js`). Los campos creados por el administrador se llaman `x_<número>` |
| `historial` | Cada cambio de cada caso: fecha, usuario, rol y qué cambió |
| `usuarios` | Usuarios de la app (la contraseña va cifrada) |
| `sesiones` | Sesiones abiertas (duran 12 horas) |
| `roles`, `campos_extra` | Roles y campos creados por el administrador desde el menú Usuarios |
| `operadores` | Listado de operadores de respaldo (código, nombre, documento), cargado desde el Excel |
| `buses` | Listado de buses (número y placa). Lo maneja el administrador en **Rutas y buses** |
| `rutas` | Lista de rutas del campo Ruta. Lo maneja el administrador en **Rutas y buses** |

Al arrancar, la app revisa la base y **solo agrega lo que falte**: tablas o columnas nuevas, como
la columna `ruta` de la tabla `casos` y la tabla `rutas` de esta versión. La tabla `rutas` se llena
con la lista inicial (6001 a 6025B) solo la vez en que se crea. Nunca borra tablas, columnas ni datos.

## Instalar o actualizar en el servidor

**Requisitos**

- [Node.js](https://nodejs.org) 22.13 o superior (se recomienda la LTS actual).
- Conexión de red desde el servidor de la app hacia el MySQL (puerto 3306), hacia el SQL Server de
  Reportes (puerto 1433) y, si se usan avisos, hacia el servidor de correo.
- Acceso a internet para `npm install` (o copiar la carpeta `node_modules` desde otro equipo).

**Pasos**

El repositorio trae el código y la carpeta `dist` (la interfaz ya compilada). **No trae** el `.env`
(contraseñas) ni `node_modules` (librerías): el `.env` se crea a mano y las librerías se instalan.

1. Copiar o clonar el proyecto en el servidor. Si es una actualización, reemplazar los archivos de
   la versión anterior **sin borrar el `.env`** que ya esté en el servidor.
2. Si el servidor todavía no tiene `.env`: copiar `.env.example` con el nombre `.env` y escribir los
   datos reales (servidores, usuarios y contraseñas). Esos datos los entrega el responsable de la app
   por un medio privado, nunca por GitHub. Ver [Archivo `.env`](#archivo-env).
3. Dentro de la carpeta del proyecto, instalar las librerías y compilar la interfaz:

   ```bash
   npm install
   ```

   ```bash
   npm run build
   ```

   (`npm install` deja `node_modules` exactamente como lo indica `package-lock.json`.)
4. Iniciar la app (o reiniciar el servicio si ya estaba instalada):

   ```bash
   npm start
   ```

La app queda en `http://localhost:3000` (o el puerto de `PORT`). Las demás personas entran desde el
navegador con `http://IP-DEL-SERVIDOR:3000`; ese puerto debe estar permitido en el firewall.

Para que siga corriendo al cerrar la sesión o reiniciar el servidor, conviene dejarla como servicio
(por ejemplo con [PM2](https://pm2.keymetrics.io) o con NSSM en Windows) ejecutando `npm start` en
la carpeta del proyecto.

## Archivo `.env`

Está en la raíz del proyecto y se lee al arrancar. Después de cambiarlo hay que reiniciar la app.

**Tiene contraseñas: no se sube a GitHub** (está en el `.gitignore`). En el repositorio solo está
`.env.example`, la plantilla vacía. En cada equipo o servidor se copia como `.env` y se llena con los
datos reales, que se comparten por un medio privado (en persona, un gestor de contraseñas, etc.).

| Variable | Para qué sirve |
| --- | --- |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | **Obligatorio.** Base de datos de la app. |
| `MSSQL_SERVER`, `MSSQL_PORT`, `MSSQL_USER`, `MSSQL_PASSWORD`, `REPORTES_DATABASE` | Base **Reportes**, de donde salen el código, el documento y el nombre del operador. Si falla, se usa el listado de respaldo. |
| `PORT` | Puerto de la app (por defecto 3000). |
| `CLAVE_INICIAL` | Contraseña temporal de los usuarios nuevos y al restablecer una contraseña. Se recomienda definirla (si no, la app usa una por defecto). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Opcional. Servidor de correo para los avisos. |
| `APP_URL` | Opcional. Dirección con la que se entra a la app (ej.: `http://IP-DEL-SERVIDOR:3000`); con ella el correo lleva el enlace directo al caso. |

## Usuarios y roles

| Rol | Qué puede modificar |
| --- | --- |
| Administrador | Todo. Crea usuarios y roles, restablece contraseñas y elimina casos |
| PESV Administrativo | Crea casos. Datos de la novedad (incluida la ruta), del tercero, policía y denuncia |
| Profesional CMO | Atención del CMO |
| SIES24 | Análisis SIES24 (incluye el estado y la responsabilidad del caso) |
| Profesional Jurídico | Gestión jurídica |
| Solo consulta | Nada: solo ve la información |

Todos los roles ven el caso completo; lo que no les corresponde aparece bloqueado. El permiso se
valida también en el servidor. **Todos los roles** tienen acceso a la pestaña **Indicadores**.

Desde el menú **Usuarios**, el administrador:

- crea un usuario por persona, con su rol y, si se quiere, su correo;
- cambia el rol o el correo, restablece la contraseña y activa o desactiva usuarios;
- crea roles nuevos: elige qué campos existentes puede editar el rol, le agrega campos propios
  (texto, número, fecha, hora o lista de opciones) y define si puede crear casos.

Desde el menú **Rutas y buses** (solo el administrador):

- **Rutas:** agrega rutas nuevas (una o varias a la vez, separadas por coma: `6026, 6027A`) y quita
  las que ya no existan. Junto a cada ruta se ve cuántos casos la tienen.
- **Buses:** agrega un bus con su placa, cambia la placa de un bus o lo quita del listado.
- Lo que se agrega aparece de inmediato en el formulario de los casos. Quitar una ruta o un bus solo
  lo saca de la lista: los casos que ya lo tienen lo conservan y se sigue viendo en ellos.

Si el administrador olvida su contraseña: `npm run restablecer-clave -- admin` la deja en la
temporal (la de `CLAVE_INICIAL` del `.env`) y se pide cambiarla al ingresar. Con `todos` en lugar de `admin`, se
restablecen todos los usuarios.

## Cómo funciona

**Lista de casos (pestaña Casos)**

- Se busca por ID, código o documento del operador, nombre, placa, ruta o lugar, y se filtra por
  **año**, **mes**, estado y tipo de daño.
- **Exportar a Excel:** el botón abre un modo de selección. Se marcan los casos que se quieren
  (o "Seleccionar todos") y se exportan los marcados, o se exportan todos los de la lista con los
  filtros aplicados. El archivo trae una fila por caso con todos los campos, agrupados por sección.
- **Casos pendientes:** el aviso de arriba muestra los casos a los que les falta información que
  le corresponde a quien está viendo (al administrador, de cualquier área), cuántos campos faltan y
  **hace cuántos días** está pendiente (desde la fecha de creación del caso).

**Casos**

- Ningún campo es obligatorio. El caso se identifica con un ID automático (`CV-0001`).
- **Los campos que se dejan vacíos quedan vacíos.** Las listas desplegables muestran solo sus
  opciones (y "Sin diligenciar"). Un campo vacío de un área queda pendiente para esa área.
- **Hora:** se escribe en formato 24 horas. Los dos puntos se ponen solos y al salir del campo
  (o con Enter) se completa: `7` → `07:00`, `730` → `07:30`, `1845` → `18:45`. Si la hora no es
  válida (por ejemplo `25:00`), se avisa y no se guarda.
- **Fecha:** se elige con el calendario de la app.
- **Operador:** al escribir el código (al completar los 4 dígitos) o el documento (apenas se deja de
  escribir un momento), la app busca al operador y completa los otros datos, el nombre y la foto.
  Enter o salir del campo lo buscan de inmediato. **Reportes manda:** si la persona está en la base
  Reportes, el código, el documento y el nombre salen de ahí. Reportes trae el nombre como
  "APELLIDOS NOMBRES" y la app lo reordena a "Nombres Apellidos" (`nombreEnOrden` en
  `server/reportes.js`): toma las dos primeras palabras como apellidos (con partículas como "de la")
  y el resto como nombres. Si alguien tiene un solo apellido y dos nombres, el orden queda mal y se
  corrige a mano en el caso. El listado de respaldo (tabla `operadores`, cargada desde el Excel) solo se
  usa si la persona no está en Reportes o si ese servidor no responde, y para completar el código de
  un retirado que Reportes trae sin código. A Reportes solo se le hacen consultas de lectura.
  Código: 4 dígitos (`799` → `0799`). Documentos: solo números.
- **Bus:** al escribir el número o la placa se completa el otro dato desde el listado de buses.
- **Ruta:** lista desplegable con las rutas de la tabla `rutas`. Al ser una lista, todas quedan
  escritas igual y los indicadores agrupan bien. El administrador la mantiene en **Rutas y buses**.
- Al abrir un caso (o cambiar de pantalla) la página empieza siempre arriba, en la ficha del
  operador, aunque en la lista se haya bajado mucho.
- Todo lo que se completa solo se puede corregir a mano.
- Cada cambio queda en el historial del caso con usuario y fecha.

## Indicadores

Pestaña **Indicadores**, disponible para todos los roles. Se calcula con los datos actuales de la
base cada vez que se abre (botón **↻ Actualizar** para recargar sin salir).

**Lo que muestra**

- **Resumen:** total de casos, casos del último mes con la variación frente al mes anterior,
  gravísimos, responsabilidad interna / externa y casos con información pendiente.
- **Cantidad de casos por mes**, con desglose a elegir: **Total general**, **Ruta**, **Tipo de daño**
  (leve, grave, gravísimo), **Responsabilidad** (interna, externa) y **Estado**. En "Ruta" se ven
  con color las 7 rutas con más casos y las demás se juntan en "Otras rutas".
- **Casos abiertos por proceso responsable** (PESV, CMO, SIES24, Jurídica y los roles creados):
  cuántos casos tienen al menos un campo de ese proceso sin llenar.
- **Por tipo de daño, por responsabilidad, por estado y por ruta** (las 10 con más casos o todas).
- **Lista de los casos** que cumplen los filtros; con clic se abre el caso.

**Cómo se usa**

- Filtros arriba: periodo rápido (Todo, Este año, Últimos 12 meses, Últimos 3 meses), Desde / Hasta,
  Ruta, Tipo de daño, Responsabilidad, Estado y "Pendiente de" (proceso).
- **Todas las barras son filtros:** un clic en un mes, una ruta, un tipo de daño, un proceso, etc.
  filtra todo el tablero; otro clic lo quita. Los filtros activos aparecen como etiquetas con ✕ y
  el botón **Limpiar todo** los quita todos. Las tarjetas "Gravísimos" y "Responsabilidad interna"
  también filtran.
- Al pasar el cursor por un mes se ve el detalle de ese mes.
- **Ver tabla** muestra la cantidad de casos mes a mes con el desglose elegido, y
  **Descargar tabla (Excel)** la descarga (archivo CSV que abre Excel).
- Los casos sin fecha de la novedad no salen en la gráfica por mes (se indica cuántos son), pero sí
  en los demás conteos.

Cómo se calcula: el servidor (`/api/indicadores`) entrega un resumen de cada caso y la página hace
los conteos en el navegador, por eso los filtros responden al instante. Un caso está "abierto" para
un proceso si le falta al menos uno de los campos que diligencia ese rol.

## Avisos por correo

Cada usuario puede tener un correo (menú **Usuarios**). Cuando se crea un caso, la app envía un
mensaje a los usuarios activos con correo que tienen algo por diligenciar (no a quien lo creó ni a
los de solo consulta), con el ID del caso, los datos básicos y el enlace para abrirlo.

Para activarlo se llenan los datos `SMTP_*` y `APP_URL` del `.env` y se reinicia la app. En el menú
**Usuarios** aparece entonces el botón **Enviar correo de prueba**. Si el servidor de correo falla,
el caso se crea igual y el error queda en la consola de la app.

## Power BI

En Power BI: **Obtener datos → Base de datos MySQL**, con el servidor y la base de la tabla de
[Dónde está cada cosa](#dónde-está-cada-cosa) (la primera vez Power BI pide instalar el conector).

- Conviene usar un usuario de MySQL de **solo lectura** y cargar las tablas `casos` e `historial`
  (no `usuarios` ni `sesiones`).
- `fecha_novedad` está guardada como texto `AAAA-MM-DD`; en Power BI se cambia a tipo Fecha.
  `creado_en` ya es de tipo fecha y hora.
- Los campos sin dato vienen vacíos. Los casos guardados con versiones anteriores pueden tener el
  texto `N/A`: antes de cambiar una columna a Fecha o a número, se reemplaza `N/A` por vacío (o se
  reemplazan los errores por *null*).

## Respaldo

Toda la información está en la base MySQL del servidor de la empresa: el respaldo se hace con
`mysqldump` o con la copia de seguridad que ya tenga ese servidor.

## Carpetas y archivos del proyecto

| Ruta | Qué es |
| --- | --- |
| `.env` | Datos de conexión y contraseñas (ver [Archivo `.env`](#archivo-env)) |
| `shared/campos.js` | Roles, secciones, campos, listas desplegables y la lista inicial de rutas (`RUTAS_INICIALES`). Un campo agregado ahí aparece en el formulario y su columna se crea sola en la base |
| `server/index.js` | Rutas del servidor: casos, indicadores, usuarios, roles, exportación |
| `server/db.js` | Conexión a MySQL y revisión de tablas y columnas al arrancar |
| `server/reportes.js` | Consulta de operadores en la base Reportes |
| `server/correo.js` | Texto y envío de los correos |
| `server/exportar.js` | Diseño del Excel exportado |
| `server/importar.js` | `npm run importar -- "archivo.xlsx"`: actualiza el listado de operadores (y buses) desde el Excel "Datos Atención Vandalismo". Los casos del Excel solo se cargan si la base no tiene ninguno, así que ya no se cargan |
| `server/importar-buses.js` | `npm run importar-buses -- "archivo.xlsx"`: actualiza el listado de buses desde el Excel "Placas Unidad SAO6" |
| `server/restablecer-clave.js` | `npm run restablecer-clave -- usuario`: deja la contraseña temporal |
| `src/App.jsx` | Barra superior y pestañas (Casos, Indicadores, Usuarios) |
| `src/componentes/` | Pantallas: `Lista` (casos), `Caso` (formulario), `Indicadores`, `Usuarios`, `Listas` (rutas y buses), `Incompletos` (aviso de pendientes), `CampoFecha` (calendario y campo de hora), `FotoOperador`, `Login`… |
| `src/estilos.css` | Diseño. Los colores están en variables al inicio del archivo |
| `public/` | Logo, ícono, fondo y letra de la app |
| `dist/` | La interfaz ya compilada (se genera con `npm run build`) |
| `node_modules/` | Librerías instaladas (se generan con `npm install`) |

## Cambios de esta versión

- **Hora escrita a mano** en lugar de la ventana para elegirla (formato 24 horas, se completa sola).
- **Ya no se llenan con `N/A`** los campos que se dejan vacíos: quedan vacíos. Las listas
  desplegables quedan solo con sus opciones. Los `N/A` que ya estaban guardados se conservan y se
  muestran igual; se pueden cambiar por el dato real.
- **Operador al instante:** la foto, el nombre y los demás datos aparecen mientras se escribe el
  código o el documento, o al dar Enter, sin tener que pasar a otro campo.
- **Operadores desde Reportes:** todos los datos del operador (también el nombre) salen de Reportes;
  el listado del Excel queda solo de respaldo para quien no está en Reportes.
- **Campo nuevo "Ruta"** en Datos de la novedad (lo llena PESV), como lista desplegable. La columna `ruta` se crea sola en la
  tabla `casos` al arrancar la app por primera vez con esta versión. Como es un campo nuevo, los
  casos anteriores quedan con la ruta vacía y aparecen como pendientes para PESV hasta que se llene.
- **Menú Rutas y buses** (administrador): agregar o quitar rutas, y agregar, cambiar la placa o quitar
  buses. Se crea la tabla `rutas` con la lista inicial.
- **Los casos se abren desde arriba**, en la ficha del operador.
- **Pestaña Indicadores** para todos los roles (ver [Indicadores](#indicadores)).
- **Desplazamiento más fluido:** el fondo se dibuja una sola vez en su propia capa y el efecto de
  vidrio de las tarjetas es más liviano.
- Limpieza: se quitaron la base SQLite anterior, el script de migración a MySQL y archivos de prueba.
