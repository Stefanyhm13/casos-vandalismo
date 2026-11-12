import { useEffect, useState } from 'react';
import { api, descargar } from '../api.js';
import { ir } from '../App.jsx';
import { CAMPOS, idCaso } from '../../shared/campos.js';
import Incompletos from './Incompletos.jsx';

export const fechaLegible = (f) => (f ? f.split('-').reverse().join('/') : '—');
export const Etiqueta = ({ valor }) =>
  valor ? <span className={'etiqueta e-' + valor.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}>{valor}</span> : <span className="suave">—</span>;

const BUSCAR_POR = {
  todo: ['Todo', 'ID, código, documento, nombre, placa o lugar'],
  id: ['ID del caso', 'Ej.: 25 o CV-0025'],
  codigo: ['Código del operador', 'Ej.: 0799'],
  documento: ['Documento del operador', 'Ej.: 71743252'],
};
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Lista({ usuario, cfg }) {
  const [q, setQ] = useState('');
  const [por, setPor] = useState('todo');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [anio, setAnio] = useState('');
  const [mes, setMes] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  // Exportar a Excel: null = apagado; si no, el conjunto de casos marcados
  const [marcados, setMarcados] = useState(null);
  const [exportando, setExportando] = useState(false);

  const filtros = { q, por, estado, tipo_dano: tipo, anio, mes };
  useEffect(() => {
    // Espera un momento mientras la persona escribe antes de consultar
    const espera = setTimeout(() => {
      api('/casos?' + new URLSearchParams(filtros)).then((d) => { setDatos(d); setError(''); }).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(espera);
  }, [q, por, estado, tipo, anio, mes]);

  const hayFiltros = q || estado || tipo || anio || mes;
  const limpiar = () => { setQ(''); setPor('todo'); setEstado(''); setTipo(''); setAnio(''); setMes(''); };

  const marcar = (id) => setMarcados((prev) => {
    const sig = new Set(prev);
    sig.has(id) ? sig.delete(id) : sig.add(id);
    return sig;
  });
  const visibles = datos?.casos.map((c) => c.id) ?? [];
  const todosMarcados = !!marcados && visibles.length > 0 && visibles.every((id) => marcados.has(id));
  const exportar = async (cuerpo) => {
    setExportando(true);
    setError('');
    try {
      await descargar('/casos/exportar', cuerpo, `casos-vandalismo-${new Date().toLocaleDateString('sv')}.xlsx`);
      setMarcados(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setExportando(false);
    }
  };
  const alElegir = (c) => (marcados ? marcar(c.id) : ir('caso/' + c.id));

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Casos de vandalismo</h1>
          <p className="suave">Busque un caso y haga clic en él para verlo o completarlo.</p>
        </div>
        <div className="acciones-lista">
          {!marcados && datos?.total > 0 && <button className="boton fantasma grande" onClick={() => setMarcados(new Set())}>Exportar a Excel</button>}
          {cfg.puedeCrear(usuario.rol) && <button className="boton primario grande" onClick={() => ir('nuevo')}>+ Nuevo caso</button>}
        </div>
      </div>

      <Incompletos cfg={cfg} usuario={usuario} />

      <div className="tarjeta filtros">
        <label className="f-por">
          Buscar por
          <select value={por} onChange={(e) => setPor(e.target.value)}>
            {Object.entries(BUSCAR_POR).map(([k, [nombre]]) => <option key={k} value={k}>{nombre}</option>)}
          </select>
        </label>
        <label className="f-q">
          ¿Qué busca?
          <input
            type="search" value={q} placeholder={BUSCAR_POR[por][1]} autoFocus
            inputMode={por === 'codigo' || por === 'documento' ? 'numeric' : undefined}
            onChange={(e) => setQ(por === 'codigo' || por === 'documento' ? e.target.value.replace(/\D/g, '') : e.target.value)}
          />
        </label>
        <label className="f-corto">
          Año
          <select value={anio} onChange={(e) => setAnio(e.target.value)}>
            <option value="">Todos</option>
            {(datos?.anios ?? []).map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="f-corto">
          Mes
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="">Todos</option>
            {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
          </select>
        </label>
        <label className="f-corto">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {CAMPOS.estado.opciones.map((o) => <option key={o}>{o}</option>)}
            <option value="(vacio)">Sin estado</option>
          </select>
        </label>
        <label className="f-corto">
          Tipo de daño
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {CAMPOS.tipo_dano.opciones.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        {hayFiltros && <button className="boton fantasma" onClick={limpiar}>Limpiar</button>}
      </div>

      {marcados && datos && (
        <div className="tarjeta barra-exportar">
          <span>
            <strong>Exportar a Excel</strong>
            <small className="suave">Marque los casos que desea exportar, o exporte todos los de la lista{hayFiltros ? ' (con los filtros aplicados)' : ''}.</small>
          </span>
          <button className="boton fantasma" onClick={() => setMarcados(todosMarcados ? new Set() : new Set(visibles))}>
            {todosMarcados ? 'Quitar selección' : 'Seleccionar todos'}
          </button>
          <button className="boton primario" disabled={exportando || !marcados.size} onClick={() => exportar({ ids: [...marcados] })}>
            Exportar seleccionados ({marcados.size})
          </button>
          <button className="boton primario" disabled={exportando || !datos.total} onClick={() => exportar({ filtros })}>
            Exportar todos ({datos.total})
          </button>
          <button className="boton fantasma" onClick={() => setMarcados(null)}>Cancelar</button>
        </div>
      )}

      {error && <div className="aviso error">{error}</div>}
      {datos && (
        <>
          <p className="conteo suave">
            {datos.total === 0 ? 'Sin resultados' : datos.total === 1 ? '1 caso' : `${datos.total} casos`}
            {datos.total > datos.casos.length && ` · se muestran los ${datos.casos.length} más recientes, use la búsqueda para encontrar los demás`}
          </p>
          {datos.casos.length === 0 ? (
            <div className="tarjeta vacio">
              <strong>No se encontraron casos</strong>
              <span className="suave">Revise lo que escribió o cambie los filtros.</span>
            </div>
          ) : (
            <div className="tarjeta tabla-caja">
              <table>
                <thead>
                  <tr>
                    {marcados && (
                      <th className="marca-fila">
                        <input type="checkbox" checked={todosMarcados} title="Seleccionar todos" onChange={() => setMarcados(todosMarcados ? new Set() : new Set(visibles))} />
                      </th>
                    )}
                    <th>ID</th><th>Fecha</th><th>Operador</th><th>Documento</th><th>Bus</th><th>Lugar</th><th>Daño</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.casos.map((c) => (
                    <tr key={c.id} tabIndex={0} className={marcados?.has(c.id) ? 'marcado' : ''} onClick={() => alElegir(c)} onKeyDown={(e) => e.key === 'Enter' && alElegir(c)}>
                      {marcados && <td className="marca-fila"><input type="checkbox" checked={marcados.has(c.id)} readOnly tabIndex={-1} /></td>}
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
