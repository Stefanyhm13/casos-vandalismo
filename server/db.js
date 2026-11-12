import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPOS } from '../shared/campos.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RUTA_DB = process.env.RUTA_DB || join(raiz, 'data', 'casos.db');
mkdirSync(dirname(RUTA_DB), { recursive: true });

export const db = new DatabaseSync(RUTA_DB);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL,
    clave TEXT NOT NULL,
    debe_cambiar INTEGER NOT NULL DEFAULT 1,
    activo INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS casos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    creado_por TEXT
  );
  CREATE TABLE IF NOT EXISTS historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caso_id INTEGER NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    usuario TEXT NOT NULL,
    rol TEXT NOT NULL,
    detalle TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS operadores (codigo TEXT PRIMARY KEY, nombre TEXT, cedula TEXT);
  CREATE TABLE IF NOT EXISTS buses (numero TEXT PRIMARY KEY, placa TEXT);
  -- Roles creados por el administrador. "campos" es la lista (JSON) de campos que puede editar.
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    campos TEXT NOT NULL DEFAULT '[]',
    puede_crear INTEGER NOT NULL DEFAULT 0
  );
  -- Campos nuevos que pertenecen a un rol creado. Su columna en "casos" se llama x_<id>.
  CREATE TABLE IF NOT EXISTS campos_extra (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rol TEXT NOT NULL,
    etiqueta TEXT NOT NULL,
    tipo TEXT NOT NULL,
    opciones TEXT NOT NULL DEFAULT '[]'
  );
`);

// Las columnas de "casos" salen de shared/campos.js: si se agrega un campo allí, se crea solo.
const existentes = new Set(db.prepare('PRAGMA table_info(casos)').all().map((c) => c.name));
const extras = db.prepare('SELECT id FROM campos_extra').all().map((c) => 'x_' + c.id);
for (const id of [...Object.keys(CAMPOS), ...extras]) {
  if (!existentes.has(id)) db.exec(`ALTER TABLE casos ADD COLUMN ${id} TEXT NOT NULL DEFAULT ''`);
}
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_casos_codigo ON casos(codigo_operador);
  CREATE INDEX IF NOT EXISTS idx_casos_cedula ON casos(cedula_operador);
  CREATE INDEX IF NOT EXISTS idx_historial_caso ON historial(caso_id);
`);

// Cambios únicos sobre datos ya existentes. "user_version" recuerda cuáles ya se aplicaron.
const version = db.prepare('PRAGMA user_version').get().user_version;
if (version < 1) {
  // Los casos cargados antes de existir la "fecha de creación" tenían la fecha en que se
  // importaron. Como no se conoce cuándo se crearon de verdad, se les pone la fecha (y hora) de la novedad.
  db.exec(`
    UPDATE casos SET creado_en = fecha_novedad || CASE WHEN hora <> '' THEN ' ' || hora || ':00' ELSE '' END
    WHERE fecha_novedad <> '';
    PRAGMA user_version = 1;
  `);
}

export function cifrarClave(clave) {
  const sal = randomBytes(16);
  return sal.toString('hex') + ':' + scryptSync(clave, sal, 64).toString('hex');
}
export function claveCorrecta(clave, guardada) {
  const [sal, hash] = guardada.split(':');
  const calculado = scryptSync(clave, Buffer.from(sal, 'hex'), 64);
  return timingSafeEqual(calculado, Buffer.from(hash, 'hex'));
}

// Usuarios iniciales (solo la primera vez). Deben cambiar la clave al entrar.
export const CLAVE_INICIAL = process.env.CLAVE_INICIAL || 'Vandalismo2026';
if (db.prepare('SELECT COUNT(*) n FROM usuarios').get().n === 0) {
  const ins = db.prepare('INSERT INTO usuarios (usuario, nombre, rol, clave) VALUES (?, ?, ?, ?)');
  for (const [usuario, nombre, rol] of [
    ['admin', 'Administrador', 'ADMIN'],
    ['pesv', 'PESV Administrativo', 'PESV-ADMIN'],
    ['cmo', 'Profesional CMO', 'PROF-CMO'],
    ['sies24', 'SIES24', 'SIES24'],
    ['juridico', 'Profesional Jurídico', 'PROF-JURIDICO'],
  ]) ins.run(usuario, nombre, rol, cifrarClave(CLAVE_INICIAL));
  console.log(`Usuarios iniciales creados (admin, pesv, cmo, sies24, juridico). Clave temporal: ${CLAVE_INICIAL}`);
}
