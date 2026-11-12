import { useState } from 'react';
import { api } from '../api.js';
import { TIPOS_NUEVOS } from '../../shared/campos.js';

// Ventana para crear o modificar un rol: nombre, si solo consulta o edita,
// qué campos existentes puede editar y qué campos nuevos son propios del rol.
export default function FormularioRol({ cfg, rol, alGuardar, alCerrar }) {
  const propiosActuales = rol ? cfg.secciones.find((s) => s.rol === rol.id && s.id === 'sec-' + rol.id)?.campos ?? [] : [];
  const [nombre, setNombre] = useState(rol?.nombre ?? '');
  const [modo, setModo] = useState(!rol || rol.campos.length || propiosActuales.length || rol.puede_crear ? 'editar' : 'ver');
  const [marcados, setMarcados] = useState(new Set(rol?.campos ?? []));
  const [propios, setPropios] = useState(
    propiosActuales.map((c) => ({ id: c.id, etiqueta: c.etiqueta, tipo: c.tipo, opciones: (c.opciones ?? []).join(', ') }))
  );
  const [puedeCrear, setPuedeCrear] = useState(!!rol?.puede_crear);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Los campos propios de este mismo rol no se listan aquí: siempre los puede editar.
  const secciones = cfg.secciones.filter((s) => !rol || s.rol !== rol.id || s.id !== 'sec-' + rol.id);

  const marcar = (ids, si) => setMarcados((prev) => {
    const sig = new Set(prev);
    ids.forEach((id) => (si ? sig.add(id) : sig.delete(id)));
    return sig;
  });
  const cambiarPropio = (i, datos) => setPropios((prev) => prev.map((p, j) => (j === i ? { ...p, ...datos } : p)));

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    const edita = modo === 'editar';
    const datos = {
      nombre,
      campos: edita ? [...marcados] : [],
      puede_crear: edita && puedeCrear,
      propios: edita ? propios.map((p) => ({ id: p.id, etiqueta: p.etiqueta, tipo: p.tipo, opciones: p.opciones.split(',') })) : [],
    };
    try {
      alGuardar(await api(rol ? '/roles/' + rol.id : '/roles', { metodo: rol ? 'PUT' : 'POST', datos }));
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <div className="velo">
      <form className="tarjeta modal" onSubmit={guardar}>
        <h2>{rol ? 'Modificar rol' : 'Crear rol nuevo'}</h2>

        <label>Nombre del rol
          <input value={nombre} autoFocus maxLength={60} placeholder="ej.: Coordinador de mantenimiento" onChange={(e) => setNombre(e.target.value)} />
        </label>

        <div className="grupo">
          <strong>¿Qué puede hacer este rol?</strong>
          <label className="casilla">
            <input type="radio" name="modo" checked={modo === 'ver'} onChange={() => setModo('ver')} />
            <span>Solo ver <small className="suave">Consulta toda la información de los casos, pero no modifica nada.</small></span>
          </label>
          <label className="casilla">
            <input type="radio" name="modo" checked={modo === 'editar'} onChange={() => setModo('editar')} />
            <span>Ver y editar <small className="suave">Ve todo y modifica solo los campos que elijas abajo.</small></span>
          </label>
        </div>

        {modo === 'editar' && (
          <>
            <div className="grupo">
              <strong>Campos existentes que puede editar <span className="suave">({marcados.size} elegidos)</span></strong>
              {secciones.map((s) => {
                const ids = s.campos.map((c) => c.id);
                const todos = ids.every((id) => marcados.has(id));
                return (
                  <fieldset key={s.id}>
                    <legend>
                      <label className="casilla">
                        <input type="checkbox" checked={todos} onChange={() => marcar(ids, !todos)} />
                        <span>{s.titulo} <small className="suave">hoy lo diligencia {cfg.roles[s.rol]}</small></span>
                      </label>
                    </legend>
                    <div className="casillas">
                      {s.campos.map((c) => (
                        <label key={c.id} className="casilla">
                          <input type="checkbox" checked={marcados.has(c.id)} onChange={(e) => marcar([c.id], e.target.checked)} />
                          <span>{c.etiqueta}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>

            <div className="grupo">
              <strong>Campos nuevos de este rol</strong>
              <small className="suave">Aparecen en cada caso, en una sección con el nombre del rol. Solo este rol y el Administrador los llenan.</small>
              {propios.map((p, i) => (
                <div key={i} className="campo-nuevo">
                  <label>Nombre del campo
                    <input value={p.etiqueta} maxLength={80} onChange={(e) => cambiarPropio(i, { etiqueta: e.target.value })} />
                  </label>
                  <label>Tipo
                    <select value={p.tipo} disabled={!!p.id} title={p.id ? 'El tipo no se puede cambiar después de creado' : undefined}
                      onChange={(e) => cambiarPropio(i, { tipo: e.target.value })}>
                      {Object.entries(TIPOS_NUEVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  {p.tipo === 'opcion' && (
                    <label className="opciones">Opciones, separadas por coma
                      <input value={p.opciones} placeholder="ej.: Si, No, Pendiente" onChange={(e) => cambiarPropio(i, { opciones: e.target.value })} />
                    </label>
                  )}
                  <button type="button" className="boton fantasma" onClick={() => {
                    if (!p.id || confirm(`¿Quitar el campo "${p.etiqueta}"? Dejará de mostrarse en los casos.`)) setPropios(propios.filter((_, j) => j !== i));
                  }}>Quitar</button>
                </div>
              ))}
              <button type="button" className="boton fantasma agregar" onClick={() => setPropios([...propios, { etiqueta: '', tipo: 'texto', opciones: '' }])}>+ Agregar campo</button>
            </div>

            <label className="casilla">
              <input type="checkbox" checked={puedeCrear} onChange={(e) => setPuedeCrear(e.target.checked)} />
              <span>Puede crear casos nuevos</span>
            </label>
          </>
        )}

        {error && <div className="aviso error">{error}</div>}
        <div className="pie">
          <button type="button" className="boton fantasma" onClick={alCerrar}>Cancelar</button>
          <button className="boton primario" disabled={guardando || !nombre.trim()}>{guardando ? 'Guardando…' : rol ? 'Guardar rol' : 'Crear rol'}</button>
        </div>
      </form>
    </div>
  );
}
