// Copia los datos de la base SQLite anterior (data/casos.db) a MySQL. Se ejecuta una sola vez.
// Uso:  npm run migrar-mysql
// Si MySQL ya tiene casos no hace nada, salvo que se pida sobrescribir:  npm run migrar-mysql -- --reemplazar
// El archivo SQLite solo se lee: queda intacto como respaldo. Las sesiones abiertas no se copian
// (cada persona vuelve a ingresar con su misma contraseña).
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { db, raiz, asegurarColumnas } from './db.js';

const ruta = process.env.RUTA_DB || join(raiz, 'data', 'casos.db');
if (!existsSync(ruta)) {
  console.error(`No se encontró la base SQLite en ${ruta}`);
  process.exit(1);
}
const yaHay = (await db.uno('SELECT COUNT(*) n FROM casos')).n;
if (yaHay && !process.argv.includes('--reemplazar')) {
  console.error(`MySQL ya tiene ${yaHay} casos. Para borrarlos y volver a copiar todo desde SQLite: npm run migrar-mysql -- --reemplazar`);
  process.exit(1);
}

const vieja = new DatabaseSync(ruta, { readOnly: true });
const leer = (tabla) => vieja.prepare(`SELECT * FROM ${tabla}`).all();

// Borra lo que haya en la tabla de MySQL y copia las filas de SQLite, conservando los ID.
async function copiar(t, tabla) {
  const filas = leer(tabla);
  await t.ejecutar(`DELETE FROM ${tabla}`);
  if (filas.length) {
    const cols = Object.keys(filas[0]);
    await t.varios(`INSERT INTO ${tabla} (${cols.map((c) => '`' + c + '`').join(', ')}) VALUES ?`, filas.map((f) => cols.map((c) => f[c])));
  }
  console.log(`  ${tabla}: ${filas.length}`);
}

console.log('Copiando de SQLite a MySQL...');
// Primero casos (su borrado arrastra el historial) y lo que no depende de ellos.
await db.transaccion(async (t) => {
  await t.ejecutar('DELETE FROM casos');
  for (const tabla of ['usuarios', 'roles', 'campos_extra', 'operadores', 'buses']) await copiar(t, tabla);
});

// Columnas de "casos": las de los campos creados por el administrador y, si quedó alguna de un
// campo que ya se quitó, también se conserva (como texto).
await asegurarColumnas();
const enMysql = new Set((await db.todos(
  "SELECT COLUMN_NAME AS nombre FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'casos'"
)).map((c) => c.nombre));
for (const { name } of vieja.prepare('PRAGMA table_info(casos)').all()) {
  if (!enMysql.has(name) && /^\w+$/.test(name)) await db.ejecutar(`ALTER TABLE casos ADD COLUMN \`${name}\` TEXT NOT NULL DEFAULT ('')`);
}

await db.transaccion(async (t) => {
  await copiar(t, 'casos');
  await copiar(t, 'historial');
});

// Comprobación: cada tabla debe tener las mismas filas en los dos lados.
let bien = true;
for (const tabla of ['usuarios', 'roles', 'campos_extra', 'operadores', 'buses', 'casos', 'historial']) {
  const a = vieja.prepare(`SELECT COUNT(*) n FROM ${tabla}`).get().n;
  const b = (await db.uno(`SELECT COUNT(*) n FROM ${tabla}`)).n;
  if (a !== b) { bien = false; console.error(`  ¡Diferencia en ${tabla}! SQLite: ${a} · MySQL: ${b}`); }
}
console.log(bien ? 'Listo: MySQL quedó con los mismos datos que SQLite.' : 'La copia terminó con diferencias: revisa los mensajes de arriba.');
await db.cerrar();
process.exit(bien ? 0 : 1);
