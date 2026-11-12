import { useEffect, useState } from 'react';
import { api } from '../api.js';
import FormularioRol from './FormularioRol.jsx';

export default function Usuarios({ yo, cfg, alCambiarRoles }) {
  const [lista, setLista] = useState([]);
  const [nuevo, setNuevo] = useState({ usuario: '', nombre: '', rol: '' });
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  // Ventana de rol: null = cerrada, { rol } = modificar, { paraNuevo: true } = crear desde el formulario de usuario
  const [ventanaRol, setVentanaRol] = useState(null);
  const ROLES = cfg.roles;
  const CREAR = '+crear';
  const elegirRol = (v) => (v === CREAR ? setVentanaRol({ paraNuevo: true }) : setNuevo({ ...nuevo, rol: v }));

  const rolGuardado = (r) => {
    alCambiarRoles({ roles: r.roles, campos: r.campos });
    if (ventanaRol.paraNuevo) setNuevo((n) => ({ ...n, rol: r.id }));
    setError('');
    setAviso(ventanaRol.rol ? 'Rol actualizado' : 'Rol creado. Ya puedes asignarlo a los usuarios.');
    setVentanaRol(null);
  };
  const eliminarRol = async (r) => {
    if (!confirm(`¿Eliminar el rol "${r.nombre}"? Sus campos propios dejarán de mostrarse en los casos.`)) return;
    setError(''); setAviso('');
    try {
      alCambiarRoles(await api('/roles/' + r.id, { metodo: 'DELETE' }));
      setAviso(`Rol "${r.nombre}" eliminado`);
    } catch (e) { setError(e.message); }
  };
  const resumen = (r) => {
    const propios = cfg.secciones.find((s) => s.id === 'sec-' + r.id)?.campos.length ?? 0;
    const partes = [];
    if (r.campos.length) partes.push(`edita ${r.campos.length} campo(s) existentes`);
    if (propios) partes.push(`${propios} campo(s) propios`);
    if (r.puede_crear) partes.push('crea casos');
    return partes.length ? 'Ver y editar · ' + partes.join(' · ') : 'Solo ver';
  };

  const cargar = () => api('/usuarios').then(setLista).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  const hacer = async (promesa, mensaje) => {
    setError(''); setAviso('');
    try {
      const r = await promesa;
      setAviso(typeof mensaje === 'function' ? mensaje(r) : mensaje);
      await cargar();
      return true;
    } catch (e) { setError(e.message); return false; }
  };

  const crear = async (e) => {
    e.preventDefault();
    const ok = await hacer(api('/usuarios', { metodo: 'POST', datos: nuevo }),
      (r) => `Usuario "${nuevo.usuario}" creado. Contraseña temporal: ${r.claveTemporal} (se le pedirá cambiarla al ingresar).`);
    if (ok) setNuevo({ usuario: '', nombre: '', rol: '' });
  };
  const editar = (u, datos, mensaje) => hacer(api('/usuarios/' + u.id, { metodo: 'PATCH', datos }), mensaje);

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Usuarios</h1>
          <p className="suave">Cada persona entra con su propio usuario. El rol define qué parte del caso puede modificar.</p>
        </div>
      </div>

      <form className="tarjeta filtros" onSubmit={crear}>
        <label className="f-q">Nombre de la persona
          <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </label>
        <label>Usuario para ingresar
          <input value={nuevo.usuario} placeholder="ej.: maria.perez" onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value.toLowerCase().replace(/\s/g, '') })} />
        </label>
        <label>Rol
          <select value={nuevo.rol} onChange={(e) => elegirRol(e.target.value)}>
            <option value="">Elegir…</option>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value={CREAR}>+ Crear rol nuevo…</option>
          </select>
        </label>
        <button className="boton primario" disabled={!nuevo.nombre || !nuevo.usuario || !nuevo.rol}>+ Crear usuario</button>
      </form>

      {error && <div className="aviso error">{error}</div>}
      {aviso && <div className="aviso ok">{aviso}</div>}

      <div className="tarjeta tabla-caja">
        <table className="sin-clic">
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'inactivo'}>
                <td>{u.nombre}</td>
                <td>{u.usuario}</td>
                <td>
                  <select value={u.rol} disabled={u.id === yo.id} onChange={(e) => editar(u, { rol: e.target.value }, `Rol de ${u.nombre} actualizado`)}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td>{!u.activo ? 'Desactivado' : u.debe_cambiar ? 'Con contraseña temporal' : 'Activo'}</td>
                <td className="acciones">
                  <button className="boton fantasma" onClick={() => confirm(`¿Restablecer la contraseña de ${u.nombre}?`) &&
                    editar(u, { restablecerClave: true }, (r) => `Contraseña temporal de ${u.nombre}: ${r.claveTemporal}`)}>Restablecer contraseña</button>
                  {u.id !== yo.id && (
                    <button className="boton fantasma" onClick={() => editar(u, { activo: !u.activo }, `${u.nombre} ${u.activo ? 'desactivado' : 'activado'}`)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="encabezado roles">
        <div>
          <h2>Roles creados</h2>
          <p className="suave">Si los roles que vienen con la aplicación no te sirven, crea uno y elige qué puede ver o editar.</p>
        </div>
        <button className="boton fantasma" onClick={() => setVentanaRol({})}>+ Crear rol</button>
      </div>
      {cfg.rolesExtra.length > 0 && (
        <div className="tarjeta tabla-caja">
          <table className="sin-clic">
            <thead><tr><th>Rol</th><th>Permisos</th><th>Usuarios</th><th></th></tr></thead>
            <tbody>
              {cfg.rolesExtra.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.nombre}</strong></td>
                  <td>{resumen(r)}</td>
                  <td>{lista.filter((u) => u.rol === r.id).length}</td>
                  <td className="acciones">
                    <button className="boton fantasma" onClick={() => setVentanaRol({ rol: r })}>Modificar</button>
                    <button className="boton fantasma" onClick={() => eliminarRol(r)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ventanaRol && <FormularioRol cfg={cfg} rol={ventanaRol.rol} alGuardar={rolGuardado} alCerrar={() => setVentanaRol(null)} />}
    </>
  );
}
