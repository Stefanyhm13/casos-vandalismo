# Casos Vandalismo

Aplicación web para registrar y hacer seguimiento a los casos de vandalismo. Reemplaza el Excel
compartido: varias personas pueden trabajar al mismo tiempo y cada área solo modifica su parte.

- **Interfaz:** React + Vite (JavaScript)
- **Servidor:** Node.js + Express
- **Base de datos:** SQLite (un archivo en `data/casos.db`, no requiere instalar nada aparte)

## Requisitos

[Node.js](https://nodejs.org) versión 22.13 o superior (se recomienda la LTS actual).

## Puesta en marcha

```bash
npm install
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

| Usuario    | Rol                  | Qué puede modificar                                              |
|------------|----------------------|------------------------------------------------------------------|
| `admin`    | Administrador        | Todo. Crea usuarios, restablece contraseñas y elimina casos      |
| `pesv`     | PESV Administrativo  | Crea casos. Datos de la novedad, del tercero, policía y denuncia |
| `cmo`      | Profesional CMO      | Atención del CMO                                                 |
| `sies24`   | SIES24               | Análisis SIES24 (incluye el estado del caso)                     |
| `juridico` | Profesional Jurídico | Gestión jurídica                                                 |

Existe además el rol **Solo consulta**. Todos los roles ven el caso completo; lo que no les
corresponde aparece bloqueado. El permiso se valida también en el servidor.

El administrador crea un usuario por persona desde el menú **Usuarios**.

## Reglas de los datos

- Ningún campo es obligatorio.
- El caso se identifica con un ID automático (`CV-0001`). Se puede buscar por ID, código o documento del operador.
- Código del operador: solo números, 4 dígitos; si se escriben menos, se completa con ceros (`799` → `0799`).
- Documentos: solo números.
- Al escribir el código del operador o el número del bus se completan nombre, documento y placa
  desde los listados importados del Excel (se pueden corregir a mano).
- Cada cambio queda en el historial del caso con usuario y fecha.

## Dónde cambiar cosas

- `shared/campos.js`: roles, secciones, campos y listas desplegables. Agregar un campo ahí lo crea
  en el formulario y en la base de datos.
- `src/estilos.css`: colores (variables al inicio del archivo).
- `public/icono.svg`: ícono de la app.

## Respaldo

Toda la información está en la carpeta `data/`. Esa carpeta no se sube a GitHub porque contiene
datos personales; hay que copiarla periódicamente como respaldo.

Variables opcionales: `PORT` (puerto), `RUTA_DB` (ubicación de la base), `CLAVE_INICIAL` (contraseña temporal).
