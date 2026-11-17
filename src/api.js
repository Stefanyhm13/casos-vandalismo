// Comunicación con el servidor. Guarda el token de sesión en el navegador.
const CLAVE = 'cv_token';
let alCerrarSesion = () => {};
export const alExpirar = (fn) => { alCerrarSesion = fn; };
export const hayToken = () => !!localStorage.getItem(CLAVE);
export const guardarToken = (t) => (t ? localStorage.setItem(CLAVE, t) : localStorage.removeItem(CLAVE));

async function pedir(ruta, metodo, datos) {
  try {
    return await fetch('/api' + ruta, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (localStorage.getItem(CLAVE) || ''),
      },
      body: datos ? JSON.stringify(datos) : undefined,
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revise la red e intente de nuevo.');
  }
}

// Pide un archivo al servidor y lo guarda con el nombre indicado (la descarga del navegador).
export async function descargar(ruta, datos, nombre) {
  const r = await pedir(ruta, 'POST', datos);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo generar el archivo. Intente de nuevo.');
  const url = URL.createObjectURL(await r.blob());
  Object.assign(document.createElement('a'), { href: url, download: nombre }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function api(ruta, { metodo = 'GET', datos } = {}) {
  const r = await pedir(ruta, metodo, datos);
  const cuerpo = await r.json().catch(() => ({}));
  if (r.status === 401 && ruta !== '/login') {
    guardarToken(null);
    alCerrarSesion();
  }
  if (!r.ok) throw new Error(cuerpo.error || 'Ocurrió un error. Intente de nuevo.');
  return cuerpo;
}
