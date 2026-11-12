// Devuelve la contraseña de un usuario (o de todos) a la temporal. Al ingresar se le pide cambiarla.
// Uso:  npm run restablecer-clave -- admin      (un usuario)
//       npm run restablecer-clave -- todos      (todos los usuarios)
// Sirve sobre todo cuando el administrador olvidó su contraseña; para los demás usuarios,
// el administrador lo hace desde el menú Usuarios.
import { db, cifrarClave, CLAVE_INICIAL } from './db.js';

const quien = String(process.argv[2] ?? '').trim().toLowerCase();
if (!quien) {
  console.error('Indique el usuario:  npm run restablecer-clave -- admin   (o "todos")');
  await db.cerrar();
  process.exit(1);
}
const usuarios = await db.todos(quien === 'todos' ? 'SELECT id, usuario FROM usuarios' : 'SELECT id, usuario FROM usuarios WHERE usuario = ?', [quien]);
if (!usuarios.length) {
  console.error(`No existe el usuario "${quien}".`);
  await db.cerrar();
  process.exit(1);
}
for (const u of usuarios) {
  // Cada usuario queda con su propio cifrado, y se cierran sus sesiones abiertas
  await db.ejecutar('UPDATE usuarios SET clave = ?, debe_cambiar = 1 WHERE id = ?', [cifrarClave(CLAVE_INICIAL), u.id]);
  await db.ejecutar('DELETE FROM sesiones WHERE usuario_id = ?', [u.id]);
}
console.log(`Contraseña temporal "${CLAVE_INICIAL}" asignada a: ${usuarios.map((u) => u.usuario).join(', ')}`);
await db.cerrar();
