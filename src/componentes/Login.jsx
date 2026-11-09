import { useState } from 'react';
import { api, guardarToken } from '../api.js';

export default function Login({ alEntrar }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await api('/login', { metodo: 'POST', datos: { usuario, clave } });
      guardarToken(r.token);
      alEntrar(r.usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="portada">
      <form className="tarjeta acceso" onSubmit={entrar}>
        <img src="/icono.svg" alt="" className="logo" />
        <h1>Casos Vandalismo</h1>
        <p className="suave">Ingresa con tu usuario para registrar y consultar casos.</p>
        <label>
          Usuario
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label>
          Contraseña
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <div className="aviso error">{error}</div>}
        <button className="boton primario grande" disabled={enviando || !usuario || !clave}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
