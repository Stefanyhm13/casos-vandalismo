import mysql from 'mysql2/promise';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPOS } from '../shared/campos.js';

export const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// Los datos de conexión se leen del archivo .env (ver .env.example) o de variables de entorno.
if (existsSync(join(raiz, '.env'))) process.loadEnvFile(join(raiz, '.env'));

const BASE = process.env.MYSQL_DATABASE || 'casos_vandalismo';
if (!/^\w+$/.test(BASE)) throw new Error('MYSQL_DATABASE solo puede tener letras, números y guion bajo');
const conexion = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  charset: 'utf8mb4',
  dateStrings: true, // las fechas llegan como texto "AAAA-MM-DD HH:MM:SS", igual que antes
};
const pool = mysql.createPool({ ...conexion, database: BASE, connectionLimit: 10 });

// Forma corta de consultar, sobre el pool o sobre una conexión con transacción abierta.
const acceso = (con) => ({
  todos: async (sql, params = []) => (await con.query(sql, params))[0],
  uno: async (sql, params = []) => (await con.query(sql, params))[0][0],
  // Devuelve el resultado de MySQL: "insertId" trae el ID recién creado.
  ejecutar: async (sql, params = []) => (await con.query(sql, params))[0],
  // Inserta muchas filas de una vez. El SQL termina en "VALUES ?" y cada fila es una lista de valores.
  varios: async (sql, filas) => {
    for (let i = 0; i < filas.length; i += 500) await con.query(sql, [filas.slice(i, i + 500)]);
  },
});

export const db = {
  ...acceso(pool),
  // Ejecuta varios cambios como uno solo: si algo falla, no queda ninguno.
  // Ojo: en MySQL un ALTER TABLE no se puede deshacer, por eso no se hacen dentro de la transacción.
  async transaccion(fn) {
    const con = await pool.getConnection();
    try {
      await con.beginTransaction();
      const r = await fn(acceso(con));
      await con.commit();
      return r;
    } catch (e) {
      await con.rollback();
      throw e;
    } finally {
      con.release();
    }
  },
  cerrar: () => pool.end(),
};

// Tipo de la columna de "casos" según el tipo de campo. Todo se guarda como texto y vacío es ''.
const TEXTO = "TEXT NOT NULL DEFAULT ('')";
const TIPOS_SQL = {
  fecha: "VARCHAR(10) NOT NULL DEFAULT ''",
  hora: "VARCHAR(5) NOT NULL DEFAULT ''",
  codigo: "VARCHAR(4) NOT NULL DEFAULT ''",
};

// Las columnas de "casos" salen de shared/campos.js y de los campos creados por el administrador
// (x_<id>): si falta alguna, se crea sola.
export async function asegurarColumnas() {
  const hay = new Set((await db.todos(
    "SELECT COLUMN_NAME AS nombre FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'casos'"
  )).map((c) => c.nombre));
  const tipos = Object.fromEntries(Object.entries(CAMPOS).map(([id, c]) => [id, c.tipo]));
  for (const c of await db.todos('SELECT id, tipo FROM campos_extra')) tipos['x_' + c.id] = c.tipo;
  for (const [id, tipo] of Object.entries(tipos)) {
    if (!hay.has(id)) await db.ejecutar(`ALTER TABLE casos ADD COLUMN \`${id}\` ${TIPOS_SQL[tipo] ?? TEXTO}`);
  }
}

async function preparar() {
  // Crea la base de datos si el usuario tiene permiso; si no, debe existir ya.
  const inicial = await mysql.createConnection(conexion);
  await inicial.query(`CREATE DATABASE IF NOT EXISTS \`${BASE}\` CHARACTER SET utf8mb4`).catch(() => {});
  await inicial.end();

  const tabla = (sql) => db.ejecutar(`CREATE TABLE IF NOT EXISTS ${sql} ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await tabla(`usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL,
    clave VARCHAR(255) NOT NULL,
    debe_cambiar TINYINT NOT NULL DEFAULT 1,
    activo TINYINT NOT NULL DEFAULT 1
  )`);
  await tabla(`sesiones (
    token CHAR(64) PRIMARY KEY,
    usuario_id INT NOT NULL,
    expira BIGINT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )`);
  await tabla(`casos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creado_por VARCHAR(255)
  )`);
  await tabla(`historial (
    id INT AUTO_INCREMENT PRIMARY KEY,
    caso_id INT NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario VARCHAR(255) NOT NULL,
    rol VARCHAR(100) NOT NULL,
    detalle TEXT NOT NULL,
    INDEX idx_historial_caso (caso_id),
    FOREIGN KEY (caso_id) REFERENCES casos(id) ON DELETE CASCADE
  )`);
  await tabla('operadores (codigo VARCHAR(20) PRIMARY KEY, nombre VARCHAR(255), cedula VARCHAR(30))');
  await tabla('buses (numero VARCHAR(20) PRIMARY KEY, placa VARCHAR(20))');
  // Roles creados por el administrador. "campos" es la lista (JSON) de campos que puede editar.
  await tabla(`roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    campos TEXT NOT NULL,
    puede_crear TINYINT NOT NULL DEFAULT 0
  )`);
  // Campos nuevos que pertenecen a un rol creado. Su columna en "casos" se llama x_<id>.
  await tabla(`campos_extra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rol VARCHAR(50) NOT NULL,
    etiqueta VARCHAR(80) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    opciones TEXT NOT NULL
  )`);

  await asegurarColumnas();
  const indices = new Set((await db.todos(
    "SELECT DISTINCT INDEX_NAME AS nombre FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'casos'"
  )).map((i) => i.nombre));
  if (!indices.has('idx_casos_codigo')) await db.ejecutar('CREATE INDEX idx_casos_codigo ON casos (codigo_operador)');
  if (!indices.has('idx_casos_cedula')) await db.ejecutar('CREATE INDEX idx_casos_cedula ON casos (cedula_operador(20))');

  // Usuarios iniciales (solo la primera vez). Deben cambiar la clave al entrar.
  if ((await db.uno('SELECT COUNT(*) n FROM usuarios')).n === 0) {
    await db.varios('INSERT INTO usuarios (usuario, nombre, rol, clave) VALUES ?', [
      ['admin', 'Administrador', 'ADMIN'],
      ['pesv', 'PESV Administrativo', 'PESV-ADMIN'],
      ['cmo', 'Profesional CMO', 'PROF-CMO'],
      ['sies24', 'SIES24', 'SIES24'],
      ['juridico', 'Profesional Jurídico', 'PROF-JURIDICO'],
    ].map((u) => [...u, cifrarClave(CLAVE_INICIAL)]));
    console.log(`Usuarios iniciales creados (admin, pesv, cmo, sies24, juridico). Clave temporal: ${CLAVE_INICIAL}`);
  }
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

export const CLAVE_INICIAL = process.env.CLAVE_INICIAL || 'Vandalismo2026';

try {
  await preparar();
} catch (e) {
  console.error(
    `No se pudo preparar la base de datos MySQL "${BASE}" en ${conexion.host}:${conexion.port} (usuario "${conexion.user}").\n` +
    `Revisa los datos de conexión en el archivo .env (ver .env.example).\nDetalle: ${e.message || e.code}`
  );
  process.exit(1);
}
