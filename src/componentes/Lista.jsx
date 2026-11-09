import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ir } from '../App.jsx';
import { CAMPOS, idCaso, puedeCrear } from '../../shared/campos.js';

export const fechaLegible = (f) => (f ? f.split('-').reverse().join('/') : '—');
export const Etiqueta = ({ valor }) =>
  valor ? <span className={'etiqueta e-' + valor.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}>{valor}</span> : <span className="suave">—</span>;

const BUSCAR_POR = {
  todo: ['Todo', 'ID, código, documento, nombre, placa o lugar'],
  id: ['ID del caso', 'Ej.: 25 o CV-0025'],
  codigo: ['Código del operador', 'Ej.: 0799'],
  documento: ['Documento del operador', 'Ej.: 71743252'],
};

export default function Lista({ usuario }) {
  const [q, setQ] = useState('');
  const [por, setPor] = useState('todo');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Espera un momento mientras la persona escribe antes de consultar
    const espera = setTimeout(() => {
      const p = new URLSearchParams({ q, por, estado, tipo_dano: tipo });
      api('/casos?' + p).then((d) => { setDatos(d); setError(''); }).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(espera);
  }, [q, por, estado, tipo]);

  const hayFiltros = q || estado || tipo;
  const limpiar = () => { setQ(''); setPor('todo'); setEstado(''); setTipo(''); };

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Casos de vandalismo</h1>
          <p className="suave">Busca un caso y haz clic en él para verlo o completarlo.</p>
        </div>
        {puedeCrear(usuario.rol) && <button className="boton primario grande" onClick={() => ir('nuevo')}>+ Nuevo caso</button>}
      </div>

      <div className="tarjeta filtros">
        <label className="f-por">
          Buscar por
          <select value={por} onChange={(e) => setPor(e.target.value)}>
            {Object.entries(BUSCAR_POR).map(([k, [nombre]]) => <option key={k} value={k}>{nombre}</option>)}
          </select>
        </label>
        <label className="f-q">
          ¿Qué buscas?
          <input
            type="search" value={q} placeholder={BUSCAR_POR[por][1]} autoFocus
            inputMode={por === 'codigo' || por === 'documento' ? 'numeric' : undefined}
            onChange={(e) => setQ(por === 'codigo' || por === 'documento' ? e.target.value.replace(/\D/g, '') : e.target.value)}
          />
        </label>
        <label>
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {CAMPOS.estado.opciones.map((o) => <option key={o}>{o}</option>)}
            <option value="(vacio)">Sin estado</option>
          </select>
        </label>
        <label>
          Tipo de daño
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {CAMPOS.tipo_dano.opciones.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        {hayFiltros && <button className="boton fantasma" onClick={limpiar}>Limpiar</button>}
      </div>

      {error && <div className="aviso error">{error}</div>}
      {datos && (
        <>
          <p className="conteo suave">
            {datos.total === 0 ? 'Sin resultados' : datos.total === 1 ? '1 caso' : `${datos.total} casos`}
            {datos.total > datos.casos.length && ` · se muestran los ${datos.casos.length} más recientes, usa la búsqueda para encontrar los demás`}
          </p>
          {datos.casos.length === 0 ? (
            <div className="tarjeta vacio">
              <strong>No se encontraron casos</strong>
              <span className="suave">Revisa lo que escribiste o cambia la opción "Buscar por".</span>
            </div>
          ) : (
            <div className="tarjeta tabla-caja">
              <table>
                <thead>
                  <tr><th>ID</th><th>Fecha</th><th>Operador</th><th>Documento</th><th>Bus</th><th>Lugar</th><th>Daño</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {datos.casos.map((c) => (
                    <tr key={c.id} tabIndex={0} onClick={() => ir('caso/' + c.id)} onKeyDown={(e) => e.key === 'Enter' && ir('caso/' + c.id)}>
                      <td><strong className="id">{idCaso(c.id)}</strong></td>
                      <td>{fechaLegible(c.fecha_novedad)}<small>{c.hora}</small></td>
                      <td>{c.nombre_operador || '—'}<small>Código {c.codigo_operador || '—'}</small></td>
                      <td>{c.cedula_operador || '—'}</td>
                      <td>{c.numero_bus || '—'}<small>{c.placa_bus}</small></td>
                      <td className="lugar">{c.lugar || '—'}</td>
                      <td><Etiqueta valor={c.tipo_dano} /></td>
                      <td><Etiqueta valor={c.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
