import express from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, asegurarColumnas, cifrarClave, claveCorrecta, CLAVE_INICIAL } from './db.js';
import { operadoresEnReportes } from './reportes.js';
import { libroDeCasos } from './exportar.js';
import { avisarCasoNuevo, correoActivo, correoValido, enviarPrueba } from './correo.js';
import { armar, TIPOS_NUEVOS, normalizar, codigo4, soloDigitos, NA, sinDato } from '../shared/campos.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const DURACION_SESION = 12 * 60 * 60 * 1000; // 12 horas
const error = (res, estado, mensaje) => res.status(estado).json({ error: mensaje });
// Roles y campos: lo fijo de shared/campos.js más lo creado por el administrador.
async function leerConfig() {
  const roles = (await db.todos('SELECT * FROM roles ORDER BY id'))
    .map((r) => ({ id: 'ROL-' + r.id, nombre: r.nombre, campos: JSON.parse(r.campos), puede_crear: !!r.puede_crear }));
  const campos = (await db.todos('SELECT * FROM campos_extra ORDER BY id'))
    .map((c) => ({ id: 'x_' + c.id, rol: c.rol, etiqueta: c.etiqueta, tipo: c.tipo, opciones: JSON.parse(c.opciones) }));
  return { crudo: { roles, campos }, ...armar(roles, campos) };
}
let cfg = await leerConfig();

const publico = (u) => ({ id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, correo: u.correo, debe_cambiar: !!u.debe_cambiar, activo: !!u.activo });

// ---------- Sesión ----------
app.post('/api/login', async (req, res) => {
  const usuario = String(req.body?.usuario ?? '').trim().toLowerCase();
  const clave = String(req.body?.clave ?? '');
  const u = await db.uno('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  if (!u || !u.activo || !claveCorrecta(clave, u.clave)) return error(res, 401, 'Usuario o contraseña incorrectos');
  await db.ejecutar('DELETE FROM sesiones WHERE expira < ?', [Date.now()]);
  const token = randomBytes(32).toString('hex');
  await db.ejecutar('INSERT INTO sesiones (token, usuario_id, expira) VALUES (?, ?, ?)', [token, u.id, Date.now() + DURACION_SESION]);
  res.json({ token, usuario: publico(u) });
});

// Todo lo demás en /api exige sesión
app.use('/api', async (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const u = token && await db.uno(
    'SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.expira > ? AND u.activo = 1',
    [token, Date.now()]
  );
  if (!u) return error(res, 401, 'Su sesión terminó. Ingrese de nuevo.');
  req.usuario = u;
  req.token = token;
  next();
});

app.get('/api/yo', (req, res) => res.json(publico(req.usuario)));
app.get('/api/config', (req, res) => res.json(cfg.crudo));

app.post('/api/logout', async (req, res) => {
  await db.ejecutar('DELETE FROM sesiones WHERE token = ?', [req.token]);
  res.json({ ok: true });
});

app.post('/api/cambiar-clave', async (req, res) => {
  const { actual = '', nueva = '' } = req.body ?? {};
  if (!claveCorrecta(String(actual), req.usuario.clave)) return error(res, 400, 'La contraseña actual no es correcta');
  if (String(nueva).length < 8) return error(res, 400, 'La nueva contraseña debe tener al menos 8 caracteres');
  if (nueva === actual) return error(res, 400, 'La nueva contraseña debe ser diferente a la actual');
  await db.ejecutar('UPDATE usuarios SET clave = ?, debe_cambiar = 0 WHERE id = ?', [cifrarClave(String(nueva)), req.usuario.id]);
  await db.ejecutar('DELETE FROM sesiones WHERE usuario_id = ? AND token <> ?', [req.usuario.id, req.token]);
  res.json({ ok: true });
});

// Mientras tenga clave temporal no puede usar el resto de la app
app.use('/api', (req, res, next) =>
  req.usuario.debe_cambiar ? error(res, 403, 'Debe cambiar su contraseña temporal') : next());

// ---------- Listados de apoyo (autocompletar) ----------
// El operador se busca primero en la base Reportes de la empresa. El listado importado del Excel
// queda de respaldo: tiene los operadores retirados (que en Reportes ya no traen código) y es el
// que responde si ese servidor no está disponible.
async function operador(columna, valor) {
  if (!valor) return null;
  const [local, encontrados] = await Promise.all([
    db.uno(`SELECT * FROM operadores WHERE ${columna} = ?`, [valor]),
    operadoresEnReportes(columna, valor),
  ]);
  const reportes = encontrados.find((o) => o.cedula === local?.cedula) || encontrados[0];
  // Si el listado dice que ese código es de otra persona, manda Reportes
  const listado = local && (!reportes || reportes.cedula === local.cedula) ? local : null;
  if (!reportes && !listado) return null;
  return {
    codigo: reportes?.codigo || listado?.codigo || '',
    cedula: reportes?.cedula || listado.cedula,
    nombre: listado?.nombre || reportes.nombre, // el del listado está como "Nombres Apellidos", igual que en los casos
  };
}
app.get('/api/operadores/:codigo', async (req, res) => {
  res.json(await operador('codigo', codigo4(req.params.codigo)));
});
app.get('/api/operadores/cedula/:cedula', async (req, res) => {
  res.json(await operador('cedula', soloDigitos(req.params.cedula)));
});
// Listado completo de buses: es corto y la app lo usa para sugerir mientras se escribe
app.get('/api/buses', async (req, res) => {
  res.json(await db.todos('SELECT numero, placa FROM buses ORDER BY CAST(numero AS UNSIGNED)'));
});

// ---------- Casos ----------
const LIMITE = 200;
// Más recientes primero; los que quedaron sin fecha (N/A) van al final.
const ORDEN = `ORDER BY (fecha_novedad = '${NA}'), fecha_novedad DESC, hora DESC, id DESC`;

// Convierte los filtros de la lista (búsqueda, estado, tipo de daño, año y mes) en un WHERE.
function filtroCasos(f = {}) {
  const q = String(f.q ?? '').trim();
  const por = String(f.por ?? 'todo');
  const donde = [];
  const params = [];
  if (q) {
    const num = soloDigitos(q);
    const como = `%${q}%`;
    const opciones = {
      id: () => { donde.push('id = ?'); params.push(Number(num) || -1); },
      codigo: () => { donde.push('codigo_operador = ?'); params.push(codigo4(q) || '-'); },
      documento: () => { donde.push('cedula_operador LIKE ?'); params.push((num || '-') + '%'); },
      todo: () => {
        const partes = ['nombre_operador LIKE ?', 'placa_bus LIKE ?', 'lugar LIKE ?'];
        params.push(como, como, como);
        if (num) {
          partes.push('id = ?', 'codigo_operador = ?', 'cedula_operador LIKE ?', 'numero_bus = ?');
          params.push(Number(num), num.length <= 4 ? codigo4(num) : '-', num + '%', num);
        }
        donde.push('(' + partes.join(' OR ') + ')');
      },
    };
    (opciones[por] ?? opciones.todo)();
  }
  for (const filtro of ['estado', 'tipo_dano']) {
    const v = String(f[filtro] ?? '');
    if (v === '(vacio)') donde.push(`${filtro} IN ('', '${NA}')`);
    else if (v) { donde.push(`${filtro} = ?`); params.push(v); }
  }
  // Año y mes de la novedad (la fecha se guarda como AAAA-MM-DD)
  const anio = /^\d{4}$/.test(f.anio) ? f.anio : '';
  const mes = /^(0[1-9]|1[0-2])$/.test(f.mes) ? f.mes : '';
  if (anio || mes) { donde.push('fecha_novedad LIKE ?'); params.push(`${anio || '____'}-${mes || '__'}-%`); }
  return { where: donde.length ? 'WHERE ' + donde.join(' AND ') : '', params };
}

app.get('/api/casos', async (req, res) => {
  const { where, params } = filtroCasos(req.query);
  const total = (await db.uno(`SELECT COUNT(*) n FROM casos ${where}`, params)).n;
  const casos = await db.todos(
    `SELECT id, fecha_novedad, hora, lugar, codigo_operador, nombre_operador, cedula_operador,
            numero_bus, placa_bus, tipo_dano, estado
     FROM casos ${where} ${ORDEN} LIMIT ${LIMITE}`,
    params
  );
  // Años que tienen casos, para el filtro
  const anios = (await db.todos(
    "SELECT DISTINCT LEFT(fecha_novedad, 4) a FROM casos WHERE fecha_novedad REGEXP '^[0-9]{4}-' ORDER BY a DESC"
  )).map((f) => f.a);
  res.json({ total, casos, anios });
});

// Excel con los casos marcados ({ ids }) o con todos los que cumplen los filtros ({ filtros }).
app.post('/api/casos/exportar', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : null;
  if (ids && !ids.length) return error(res, 400, 'Marque al menos un caso para exportar');
  const { where, params } = ids ? { where: 'WHERE id IN (?)', params: [ids] } : filtroCasos(req.body?.filtros);
  const casos = await db.todos(`SELECT * FROM casos ${where} ${ORDEN}`, params);
  if (!casos.length) return error(res, 400, 'No hay casos para exportar');
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(await libroDeCasos(casos, cfg, req.usuario));
});

const buscarCaso = (id) => db.uno('SELECT * FROM casos WHERE id = ?', [Number(id) || -1]);
const detalle = async (caso) => ({
  caso,
  historial: await db.todos('SELECT fecha, usuario, rol, detalle FROM historial WHERE caso_id = ? ORDER BY id DESC', [caso.id]),
});

// Devuelve solo los campos que el usuario tiene permiso de modificar y que realmente cambian.
// Si intenta tocar un campo de otra área, se rechaza toda la solicitud.
function cambiosPermitidos(usuario, cuerpo, actual = {}) {
  const cambios = {};
  for (const [id, valor] of Object.entries(cuerpo ?? {})) {
    const campo = cfg.campos[id];
    if (!campo) continue;
    const nuevo = normalizar(campo, valor);
    if (nuevo === (actual[id] ?? '')) continue;
    if (!cfg.puedeEditar(usuario.rol, id)) {
      return { prohibido: `No tiene permiso para modificar "${campo.etiqueta}". Ese campo lo diligencia ${cfg.roles[campo.rol]}.` };
    }
    cambios[id] = nuevo;
  }
  return { cambios };
}
// Al guardar, los campos que la persona puede diligenciar y dejó vacíos quedan como "N/A".
// Los de otras áreas no se tocan: siguen pendientes para su responsable. Devuelve los que marcó.
function vaciosComoNA(usuario, cambios, actual = {}) {
  const marcados = Object.keys(cfg.campos).filter((id) => cfg.puedeEditar(usuario.rol, id) && (cambios[id] ?? actual[id] ?? '') === '');
  for (const id of marcados) cambios[id] = NA;
  return marcados;
}
const nombres = (ids) => ids.map((c) => cfg.campos[c].etiqueta).join(', ');
const registrar = (casoId, u, texto) =>
  db.ejecutar('INSERT INTO historial (caso_id, usuario, rol, detalle) VALUES (?, ?, ?, ?)', [casoId, u.nombre, cfg.roles[u.rol] ?? u.rol, texto]);

app.get('/api/casos/:id', async (req, res) => {
  const caso = await buscarCaso(req.params.id);
  caso ? res.json(await detalle(caso)) : error(res, 404, 'No existe un caso con ese ID');
});

// Todos los casos del mismo operador (por documento; si no tiene, por código)
app.get('/api/casos/:id/operador', async (req, res) => {
  const caso = await buscarCaso(req.params.id);
  if (!caso) return error(res, 404, 'No existe un caso con ese ID');
  const [columna, valor] = !sinDato(caso.cedula_operador) ? ['cedula_operador', caso.cedula_operador]
    : !sinDato(caso.codigo_operador) ? ['codigo_operador', caso.codigo_operador] : ['id', caso.id];
  res.json(await db.todos(
    `SELECT id, fecha_novedad, tipo_dano, estado FROM casos WHERE ${columna} = ? ORDER BY fecha_novedad DESC, id DESC`,
    [valor]
  ));
});

app.post('/api/casos', async (req, res) => {
  if (!cfg.puedeCrear(req.usuario.rol)) return error(res, 403, 'Su rol no puede crear casos nuevos');
  const { cambios, prohibido } = cambiosPermitidos(req.usuario, req.body);
  if (prohibido) return error(res, 403, prohibido);
  vaciosComoNA(req.usuario, cambios);
  const cols = Object.keys(cambios);
  const r = await db.ejecutar(
    `INSERT INTO casos (creado_por${cols.map((c) => ', ' + c).join('')}) VALUES (?${', ?'.repeat(cols.length)})`,
    [req.usuario.nombre, ...Object.values(cambios)]
  );
  await registrar(r.insertId, req.usuario, 'Creó el caso');
  const caso = await buscarCaso(r.insertId);
  res.status(201).json(await detalle(caso));
  // Aviso por correo a quienes deben completar el caso (no detiene la respuesta)
  if (correoActivo()) {
    const usuarios = await db.todos("SELECT nombre, correo, rol FROM usuarios WHERE activo = 1 AND correo <> '' AND id <> ?", [req.usuario.id]);
    const destinatarios = usuarios
      .filter((u) => Object.keys(cfg.campos).some((id) => cfg.puedeEditar(u.rol, id)))
      .map((u) => ({ nombre: u.nombre, correo: u.correo, area: cfg.roles[u.rol] ?? 'su área' }));
    avisarCasoNuevo(caso, req.usuario, destinatarios).catch((e) => console.error('Aviso por correo:', e.message));
  }
});

app.patch('/api/casos/:id', async (req, res) => {
  const caso = await buscarCaso(req.params.id);
  if (!caso) return error(res, 404, 'No existe un caso con ese ID');
  const { cambios, prohibido } = cambiosPermitidos(req.usuario, req.body, caso);
  if (prohibido) return error(res, 403, prohibido);
  const modificados = Object.keys(cambios).filter((c) => cambios[c] !== '');
  const marcados = vaciosComoNA(req.usuario, cambios, caso);
  const cols = Object.keys(cambios);
  if (cols.length) {
    await db.ejecutar(`UPDATE casos SET ${cols.map((c) => c + ' = ?').join(', ')} WHERE id = ?`, [...Object.values(cambios), caso.id]);
    await registrar(caso.id, req.usuario, [
      modificados.length && 'Modificó: ' + nombres(modificados),
      marcados.length && 'Dejó como N/A: ' + nombres(marcados),
    ].filter(Boolean).join('. '));
  }
  res.json(await detalle(await buscarCaso(caso.id)));
});

// ---------- Solo administrador ----------
const soloAdmin = (req, res, next) => (req.usuario.rol === 'ADMIN' ? next() : error(res, 403, 'Solo el administrador puede hacer esto'));

app.delete('/api/casos/:id', soloAdmin, async (req, res) => {
  await db.ejecutar('DELETE FROM casos WHERE id = ?', [Number(req.params.id) || -1]);
  res.json({ ok: true });
});

// Casos a los que les falta llenar algún campo de los que este usuario puede diligenciar
// (el administrador: todos los campos). Incluye la lista de campos que faltan; primero el que lleva más días pendiente.
app.get('/api/casos-incompletos', async (req, res) => {
  const ids = Object.keys(cfg.campos).filter((id) => cfg.puedeEditar(req.usuario.rol, id));
  if (!ids.length) return res.json([]);
  const casos = await db.todos(
    `SELECT * FROM casos WHERE ${ids.map((c) => `${c} = ''`).join(' OR ')} ORDER BY creado_en, id`
  );
  res.json(casos.map((c) => ({
    id: c.id, nombre_operador: c.nombre_operador, fecha_novedad: c.fecha_novedad, creado_en: c.creado_en, faltan: ids.filter((id) => !c[id]),
  })));
});

app.get('/api/usuarios', soloAdmin, async (req, res) => {
  res.json((await db.todos('SELECT * FROM usuarios ORDER BY activo DESC, nombre')).map(publico));
});

app.post('/api/usuarios', soloAdmin, async (req, res) => {
  const usuario = String(req.body?.usuario ?? '').trim().toLowerCase();
  const nombre = String(req.body?.nombre ?? '').trim();
  const rol = String(req.body?.rol ?? '');
  const correo = String(req.body?.correo ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return error(res, 400, 'El usuario debe tener entre 3 y 30 letras o números, sin espacios');
  if (!nombre) return error(res, 400, 'Escriba el nombre de la persona');
  if (!cfg.roles[rol]) return error(res, 400, 'Elija un rol');
  if (correo && !correoValido(correo)) return error(res, 400, 'El correo no es válido');
  if (await db.uno('SELECT 1 FROM usuarios WHERE usuario = ?', [usuario])) return error(res, 400, 'Ya existe ese nombre de usuario');
  await db.ejecutar('INSERT INTO usuarios (usuario, nombre, rol, correo, clave) VALUES (?, ?, ?, ?, ?)', [usuario, nombre, rol, correo, cifrarClave(CLAVE_INICIAL)]);
  res.status(201).json({ ok: true, claveTemporal: CLAVE_INICIAL });
});

app.patch('/api/usuarios/:id', soloAdmin, async (req, res) => {
  const u = await db.uno('SELECT * FROM usuarios WHERE id = ?', [Number(req.params.id) || -1]);
  if (!u) return error(res, 404, 'Usuario no encontrado');
  const { nombre, rol, activo, restablecerClave } = req.body ?? {};
  const correo = req.body?.correo === undefined ? undefined : String(req.body.correo).trim().toLowerCase();
  if (correo && !correoValido(correo)) return error(res, 400, 'El correo no es válido');
  const esMismo = u.id === req.usuario.id;
  if (esMismo && (activo === false || (rol && rol !== 'ADMIN'))) return error(res, 400, 'No puede quitarse su propio acceso de administrador');
  if (rol !== undefined && !cfg.roles[rol]) return error(res, 400, 'Rol no válido');
  if (nombre !== undefined && String(nombre).trim()) await db.ejecutar('UPDATE usuarios SET nombre = ? WHERE id = ?', [String(nombre).trim(), u.id]);
  if (rol !== undefined) await db.ejecutar('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, u.id]);
  if (correo !== undefined) await db.ejecutar('UPDATE usuarios SET correo = ? WHERE id = ?', [correo, u.id]);
  if (activo !== undefined) {
    await db.ejecutar('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, u.id]);
    if (!activo) await db.ejecutar('DELETE FROM sesiones WHERE usuario_id = ?', [u.id]);
  }
  if (restablecerClave) {
    await db.ejecutar('UPDATE usuarios SET clave = ?, debe_cambiar = 1 WHERE id = ?', [cifrarClave(CLAVE_INICIAL), u.id]);
    await db.ejecutar('DELETE FROM sesiones WHERE usuario_id = ?', [u.id]);
  }
  res.json({ ok: true, claveTemporal: restablecerClave ? CLAVE_INICIAL : undefined });
});

// Estado del envío de correos y correo de prueba (para comprobar los datos SMTP_* del .env)
app.get('/api/correo', soloAdmin, (req, res) => res.json({ activo: correoActivo() }));
app.post('/api/correo/prueba', soloAdmin, async (req, res) => {
  if (!correoActivo()) return error(res, 400, 'El envío de correos no está configurado en el servidor (datos SMTP_* del archivo .env)');
  if (!req.usuario.correo) return error(res, 400, 'Primero escriba su propio correo en la lista de usuarios');
  try {
    await enviarPrueba(req.usuario);
    res.json({ ok: true, correo: req.usuario.correo });
  } catch (e) {
    error(res, 502, 'El servidor de correo rechazó el envío: ' + e.message);
  }
});

// ---------- Roles creados por el administrador ----------
// Revisa lo que llega del formulario de rol. Devuelve { falla } o los datos limpios.
function leerRol(cuerpo, idActual) {
  const nombre = String(cuerpo?.nombre ?? '').trim().slice(0, 60);
  if (!nombre) return { falla: 'Escriba el nombre del rol' };
  if (Object.entries(cfg.roles).some(([id, n]) => id !== idActual && n.toLowerCase() === nombre.toLowerCase())) {
    return { falla: 'Ya existe un rol con ese nombre' };
  }
  const lista = (v) => (Array.isArray(v) ? v : []);
  const campos = [...new Set(lista(cuerpo.campos))].filter((c) => cfg.campos[c] && cfg.campos[c].rol !== idActual);
  const propios = [];
  for (const p of lista(cuerpo.propios)) {
    const etiqueta = String(p?.etiqueta ?? '').trim().slice(0, 80);
    if (!etiqueta) return { falla: 'Cada campo nuevo necesita un nombre' };
    if (!TIPOS_NUEVOS[p.tipo]) return { falla: `Elija el tipo del campo "${etiqueta}"` };
    const opciones = p.tipo === 'opcion' ? [...new Set(lista(p.opciones).map((o) => String(o).trim()).filter(Boolean))] : [];
    if (p.tipo === 'opcion' && opciones.length < 2) return { falla: `Escriba al menos dos opciones para "${etiqueta}"` };
    propios.push({ id: p.id, etiqueta, tipo: p.tipo, opciones });
  }
  return { nombre, campos, propios, puede_crear: cuerpo.puede_crear ? 1 : 0 };
}

// Crea, actualiza o quita los campos propios de un rol ("t" es la transacción en curso). Al quitar
// un campo solo deja de mostrarse: su columna y lo ya diligenciado se conservan en la base de datos.
// La columna de un campo nuevo la crea asegurarColumnas() al terminar la transacción.
async function guardarPropios(t, rolId, propios) {
  const actuales = cfg.crudo.campos.filter((c) => c.rol === rolId);
  const conservar = new Set();
  for (const p of propios) {
    const ya = actuales.find((c) => c.id === p.id);
    if (ya) {
      conservar.add(ya.id);
      // El tipo no cambia: ya puede haber casos diligenciados con él.
      await t.ejecutar('UPDATE campos_extra SET etiqueta = ?, opciones = ? WHERE id = ?',
        [p.etiqueta, JSON.stringify(ya.tipo === 'opcion' && p.opciones.length >= 2 ? p.opciones : ya.opciones), Number(ya.id.slice(2))]);
    } else {
      await t.ejecutar('INSERT INTO campos_extra (rol, etiqueta, tipo, opciones) VALUES (?, ?, ?, ?)',
        [rolId, p.etiqueta, p.tipo, JSON.stringify(p.opciones)]);
    }
  }
  for (const c of actuales) {
    if (!conservar.has(c.id)) await t.ejecutar('DELETE FROM campos_extra WHERE id = ?', [Number(c.id.slice(2))]);
  }
}

// Ejecuta varios cambios como uno solo, crea las columnas que hagan falta y recarga roles y campos.
async function enBloque(fn) {
  try {
    await db.transaccion(fn);
    await asegurarColumnas();
  } finally {
    cfg = await leerConfig();
  }
}

app.post('/api/roles', soloAdmin, async (req, res) => {
  const d = leerRol(req.body);
  if (d.falla) return error(res, 400, d.falla);
  let id;
  await enBloque(async (t) => {
    const r = await t.ejecutar('INSERT INTO roles (nombre, campos, puede_crear) VALUES (?, ?, ?)', [d.nombre, JSON.stringify(d.campos), d.puede_crear]);
    id = 'ROL-' + r.insertId;
    await guardarPropios(t, id, d.propios);
  });
  res.status(201).json({ id, ...cfg.crudo });
});

app.put('/api/roles/:id', soloAdmin, async (req, res) => {
  const rol = cfg.rolesExtra.find((r) => r.id === req.params.id);
  if (!rol) return error(res, 404, 'Rol no encontrado');
  const d = leerRol(req.body, rol.id);
  if (d.falla) return error(res, 400, d.falla);
  await enBloque(async (t) => {
    await t.ejecutar('UPDATE roles SET nombre = ?, campos = ?, puede_crear = ? WHERE id = ?', [d.nombre, JSON.stringify(d.campos), d.puede_crear, Number(rol.id.slice(4))]);
    await guardarPropios(t, rol.id, d.propios);
  });
  res.json({ id: rol.id, ...cfg.crudo });
});

app.delete('/api/roles/:id', soloAdmin, async (req, res) => {
  const rol = cfg.rolesExtra.find((r) => r.id === req.params.id);
  if (!rol) return error(res, 404, 'Rol no encontrado');
  const n = (await db.uno('SELECT COUNT(*) n FROM usuarios WHERE rol = ?', [rol.id])).n;
  if (n) return error(res, 400, `Hay ${n} usuario(s) con este rol. Cámbieles el rol antes de eliminarlo.`);
  await enBloque(async (t) => {
    await guardarPropios(t, rol.id, []);
    await t.ejecutar('DELETE FROM roles WHERE id = ?', [Number(rol.id.slice(4))]);
  });
  res.json(cfg.crudo);
});

app.use('/api', (req, res) => error(res, 404, 'Ruta no encontrada'));

// ---------- App web ya compilada (npm run build) ----------
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/.*/, (req, res) => res.sendFile(join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  error(res, 500, 'Ocurrió un error en el servidor');
});

const PUERTO = Number(process.env.PORT) || 3000;
app.listen(PUERTO, () => console.log(`Casos Vandalismo listo en http://localhost:${PUERTO}`));
