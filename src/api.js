// Comunicación con el servidor. Guarda el token de sesión en el navegador.
const CLAVE = 'cv_token';
let alCerrarSesion = () => {};
export const alExpirar = (fn) => { alCerrarSesion = fn; };
export const hayToken = () => !!localStorage.getItem(CLAVE);
export const guardarToken = (t) => (t ? localStorage.setItem(CLAVE, t) : localStorage.removeItem(CLAVE));

export async function api(ruta, { metodo = 'GET', datos } = {}) {
  let r;
  try {
    r = await fetch('/api' + ruta, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (localStorage.getItem(CLAVE) || ''),
      },
      body: datos ? JSON.stringify(datos) : undefined,
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa la red e intenta de nuevo.');
  }
  const cuerpo = await r.json().catch(() => ({}));
  if (r.status === 401 && ruta !== '/login') {
    guardarToken(null);
    alCerrarSesion();
  }
  if (!r.ok) throw new Error(cuerpo.error || 'Ocurrió un error. Intenta de nuevo.');
  return cuerpo;
}
