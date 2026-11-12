import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ir } from '../App.jsx';
import { idCaso } from '../../shared/campos.js';
import { fechaLegible } from './Lista.jsx';

// Aviso de casos con campos sin llenar. El administrador ve todos los campos; los demás roles,
// solo los casos donde falta información que les corresponde a ellos. Al desplegarlo se ve la lista
// y, al pasar el cursor por un caso, una vista previa de lo que falta agrupado por responsable.
export default function Incompletos({ cfg, usuario }) {
  const esAdmin = usuario.rol === 'ADMIN';
  // Los roles de solo consulta no llenan nada: no se les muestra el aviso
  const llenaAlgo = Object.keys(cfg.campos).some((id) => cfg.puedeEditar(usuario.rol, id));
  const [casos, setCasos] = useState(null);
  const [sobre, setSobre] = useState(null);
  useEffect(() => { api('/casos-incompletos').then(setCasos).catch(() => setCasos(null)); }, []);
  if (!casos || !llenaAlgo) return null;
  if (!casos.length) {
    return <div className="aviso ok">{esAdmin ? 'Todos los casos tienen sus campos completos.' : 'Estás al día: no tienes casos con información tuya por llenar.'}</div>;
  }

  // Campos faltantes del caso bajo el cursor, agrupados por el rol que los diligencia
  const grupos = {};
  for (const id of sobre?.faltan ?? []) {
    const campo = cfg.campos[id];
    if (campo) (grupos[cfg.roles[campo.rol] ?? campo.rol] ??= []).push(campo.etiqueta);
  }

  return (
    <details className="tarjeta pendientes">
      <summary>
        <span className="alerta">!</span>
        {esAdmin
          ? <span>Hay <strong>{casos.length}</strong> {casos.length === 1 ? 'caso que falta' : 'casos que faltan'} por llenar campos</span>
          : <span>Tienes <strong>{casos.length}</strong> {casos.length === 1 ? 'caso' : 'casos'} con información tuya por llenar</span>}
        <span className="suave ver">Ver lista</span>
      </summary>
      <div className="pendientes-cuerpo">
        {/* La vista previa se queda con el último caso señalado, para poder llevar el cursor hasta ella y leerla */}
        <ul>
          {casos.map((c) => (
            <li key={c.id} className={sobre?.id === c.id ? 'activo' : ''} onMouseEnter={() => setSobre(c)} onFocus={() => setSobre(c)}>
              <strong className="id">{idCaso(c.id)}</strong>
              <span className="quien-es">{c.nombre_operador || 'Operador sin registrar'}<small>{fechaLegible(c.fecha_novedad)}</small></span>
              <span className="cuantos">{c.faltan.length === 1 ? 'Falta 1 campo' : `Faltan ${c.faltan.length} campos`}</span>
              <button className="boton fantasma" onClick={() => ir('caso/' + c.id)}>Ver caso</button>
            </li>
          ))}
        </ul>
        <aside className="previa">
          {sobre ? (
            <>
              <h3><span className="id">{idCaso(sobre.id)}</span> · {esAdmin ? 'campos por llenar' : 'campos que te falta llenar'}</h3>
              {Object.entries(grupos).map(([rol, campos]) => (
                <div key={rol} className="previa-grupo">
                  <strong>{rol} <span className="suave">({campos.length})</span></strong>
                  <div>{campos.map((e) => <span key={e} className="etiqueta">{e}</span>)}</div>
                </div>
              ))}
            </>
          ) : (
            <p className="suave">{esAdmin
              ? 'Pasa el cursor por un caso para ver qué campos le faltan y quién es el responsable de llenarlos.'
              : 'Pasa el cursor por un caso para ver qué campos te falta llenar.'}</p>
          )}
        </aside>
      </div>
    </details>
  );
}
