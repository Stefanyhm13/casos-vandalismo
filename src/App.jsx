import { useEffect, useMemo, useState } from 'react';
import { api, alExpirar, guardarToken, hayToken } from './api.js';
import { armar } from '../shared/campos.js';
import Login from './componentes/Login.jsx';
import CambiarClave from './componentes/CambiarClave.jsx';
import Lista from './componentes/Lista.jsx';
import Caso from './componentes/Caso.jsx';
import Usuarios from './componentes/Usuarios.jsx';
import Indicadores from './componentes/Indicadores.jsx';
import Listas from './componentes/Listas.jsx';

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
  const cfg = useMemo(() => extras && armar(extras.roles, extras.campos, extras.rutas), [extras]);
  const idUsuario = usuario?.id;
  useEffect(() => {
    setExtras(null);
    if (idUsuario) api('/config').then(setExtras).catch(() => setExtras({ roles: [], campos: [], rutas: [] }));
  }, [idUsuario]);

  useEffect(() => {
    // Cada vez que se cambia de pantalla (abrir un caso, volver a la lista…) se empieza desde arriba,
    // donde están el nombre y la foto del operador, y no a la altura donde iba la pantalla anterior.
    const alCambiar = () => { setRuta(leerRuta()); window.scrollTo({ top: 0, behavior: 'instant' }); };
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
  else if (seccion === 'indicadores') pagina = <Indicadores />;
  else if (seccion === 'listas' && usuario.rol === 'ADMIN') pagina = <Listas cfg={cfg} alCambiar={setExtras} />;
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
          <a href="#/indicadores" className={seccion === 'indicadores' ? 'activo' : ''}>Indicadores</a>
          {usuario.rol === 'ADMIN' && <a href="#/usuarios" className={seccion === 'usuarios' ? 'activo' : ''}>Usuarios</a>}
          {usuario.rol === 'ADMIN' && <a href="#/listas" className={seccion === 'listas' ? 'activo' : ''}>Rutas y buses</a>}
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
