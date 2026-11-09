import { useState } from 'react';
import { api } from '../api.js';

export default function CambiarClave({ obligatorio, alTerminar, alSalir }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');

  const guardar = async (e) => {
    e.preventDefault();
    if (nueva !== repetir) return setError('Las dos contraseñas nuevas no coinciden');
    try {
      await api('/cambiar-clave', { metodo: 'POST', datos: { actual, nueva } });
      alTerminar();
    } catch (err) {
      setError(err.message);
    }
  };

  const formulario = (
    <form className="tarjeta acceso" onSubmit={guardar}>
      <h1>{obligatorio ? 'Crea tu contraseña' : 'Cambiar contraseña'}</h1>
      {obligatorio && <p className="suave">Estás usando una contraseña temporal. Antes de continuar, crea una que solo tú conozcas.</p>}
      <label>
        {obligatorio ? 'Contraseña temporal' : 'Contraseña actual'}
        <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus autoComplete="current-password" />
      </label>
      <label>
        Nueva contraseña <small className="suave">(mínimo 8 caracteres)</small>
        <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" />
      </label>
      <label>
        Repite la nueva contraseña
        <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />
      </label>
      {error && <div className="aviso error">{error}</div>}
      <button className="boton primario grande" disabled={!actual || !nueva || !repetir}>Guardar contraseña</button>
      <button type="button" className="boton fantasma" onClick={alSalir}>{obligatorio ? 'Salir' : 'Cancelar'}</button>
    </form>
  );
  return obligatorio ? <div className="portada">{formulario}</div> : formulario;
}
