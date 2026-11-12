import { useEffect, useMemo, useState } from 'react';
import { api, alExpirar, guardarToken, hayToken } from './api.js';
import { armar } from '../shared/campos.js';
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
  // Roles y campos creados por el administrador (se suman a los fijos)
  const [extras, setExtras] = useState(null);
  const cfg = useMemo(() => extras && armar(extras.roles, extras.campos), [extras]);
  const idUsuario = usuario?.id;
  useEffect(() => {
    setExtras(null);
    if (idUsuario) api('/config').then(setExtras).catch(() => setExtras({ roles: [], campos: [] }));
  }, [idUsuario]);

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

  if (!cfg) return <div className="centro suave">Cargando…</div>;

  const [seccion, parametro] = ruta.split('/');
  let pagina;
  if (seccion === 'caso') pagina = <Caso key={parametro} id={parametro} usuario={usuario} cfg={cfg} />;
  else if (seccion === 'nuevo') pagina = <Caso key="nuevo" id={null} usuario={usuario} cfg={cfg} />;
  else if (seccion === 'usuarios' && usuario.rol === 'ADMIN') pagina = <Usuarios yo={usuario} cfg={cfg} alCambiarRoles={setExtras} />;
  else pagina = <Lista usuario={usuario} cfg={cfg} />;

  return (
    <>
      <header className="barra">
        <a className="marca" href="#/">
          <img src="/logo.png" alt="SAO" />
          <span>Casos Vandalismo<small>Sistema Alimentador Oriental</small></span>
        </a>
        <nav>
          <a href="#/" className={!seccion || seccion === 'caso' || seccion === 'nuevo' ? 'activo' : ''}>Casos</a>
          {usuario.rol === 'ADMIN' && <a href="#/usuarios" className={seccion === 'usuarios' ? 'activo' : ''}>Usuarios</a>}
        </nav>
        <div className="quien">
          <div>
            <strong>{usuario.nombre}</strong>
            <small>{cfg.roles[usuario.rol]}</small>
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
