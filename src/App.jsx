import { useEffect, useState } from 'react';
import { api, alExpirar, guardarToken, hayToken } from './api.js';
import { ROLES } from '../shared/campos.js';
import Login from './componentes/Login.jsx';
import CambiarClave from './componentes/CambiarClave.jsx';
import Lista from './componentes/Lista.jsx';
import Caso from './componentes/Caso.jsx';
import Usuarios from './componentes/Usuarios.jsx';

// Navegación sencilla con la parte "#/..." de la dirección
const leerRuta = () => window.location.hash.replace(/^#\/?/, '');
export const ir = (ruta) => { window.location.hash = '/' + ruta; };

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(hayToken());
  const [ruta, setRuta] = useState(leerRuta());
  const [cambiandoClave, setCambiandoClave] = useState(false);

  useEffect(() => {
    const alCambiar = () => setRuta(leerRuta());
    window.addEventListener('hashchange', alCambiar);
    alExpirar(() => setUsuario(null));
    if (hayToken()) api('/yo').then(setUsuario).catch(() => {}).finally(() => setCargando(false));
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  const salir = async () => {
    await api('/logout', { metodo: 'POST' }).catch(() => {});
    guardarToken(null);
    setUsuario(null);
    ir('');
  };

  if (cargando) return <div className="centro suave">Cargando…</div>;
  if (!usuario) return <Login alEntrar={setUsuario} />;
  if (usuario.debe_cambiar) {
    return <CambiarClave obligatorio alTerminar={() => setUsuario({ ...usuario, debe_cambiar: false })} alSalir={salir} />;
  }

  const [seccion, parametro] = ruta.split('/');
  let pagina;
  if (seccion === 'caso') pagina = <Caso key={parametro} id={parametro} usuario={usuario} />;
  else if (seccion === 'nuevo') pagina = <Caso key="nuevo" id={null} usuario={usuario} />;
  else if (seccion === 'usuarios' && usuario.rol === 'ADMIN') pagina = <Usuarios yo={usuario} />;
  else pagina = <Lista usuario={usuario} />;

  return (
    <>
      <header className="barra">
        <a className="marca" href="#/">
          <img src="/icono.svg" alt="" />
          <span>Casos Vandalismo</span>
        </a>
        <nav>
          <a href="#/" className={!seccion || seccion === 'caso' || seccion === 'nuevo' ? 'activo' : ''}>Casos</a>
          {usuario.rol === 'ADMIN' && <a href="#/usuarios" className={seccion === 'usuarios' ? 'activo' : ''}>Usuarios</a>}
        </nav>
        <div className="quien">
          <div>
            <strong>{usuario.nombre}</strong>
            <small>{ROLES[usuario.rol]}</small>
          </div>
          <button className="boton fantasma claro" onClick={() => setCambiandoClave(true)}>Cambiar contraseña</button>
          <button className="boton fantasma claro" onClick={salir}>Salir</button>
        </div>
      </header>
      <main className="contenido">{pagina}</main>
      {cambiandoClave && (
        <div className="velo" onClick={() => setCambiandoClave(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <CambiarClave alTerminar={() => setCambiandoClave(false)} alSalir={() => setCambiandoClave(false)} />
          </div>
        </div>
      )}
    </>
  );
}
