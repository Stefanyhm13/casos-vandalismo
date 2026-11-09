import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ir } from '../App.jsx';
import { Etiqueta, fechaLegible } from './Lista.jsx';
import { SECCIONES, ROLES, puedeEditar, puedeCrear, idCaso, codigo4, soloDigitos } from '../../shared/campos.js';

// Un campo editable. Las fechas y horas abren el selector del navegador al hacer clic.
function Entrada({ campo, valor, cambiar, alSalir }) {
  const comun = { id: campo.id, value: valor, onChange: (e) => cambiar(e.target.value), onBlur: alSalir };
  const abrir = (e) => { try { e.target.showPicker?.(); } catch { /* el navegador no lo permite */ } };
  switch (campo.tipo) {
    case 'fecha': return <input type="date" {...comun} onClick={abrir} />;
    case 'hora': return <input type="time" {...comun} onClick={abrir} />;
    case 'area': return <textarea rows={3} {...comun} />;
    case 'opcion':
      return (
        <select {...comun}>
          <option value="">Sin diligenciar</option>
          {campo.opciones.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    case 'codigo':
      return <input inputMode="numeric" maxLength={4} placeholder="0000" {...comun} onChange={(e) => cambiar(soloDigitos(e.target.value).slice(0, 4))} />;
    case 'numero':
      return <input inputMode="numeric" maxLength={15} {...comun} onChange={(e) => cambiar(soloDigitos(e.target.value))} />;
    case 'mayus':
      return <input {...comun} onChange={(e) => cambiar(e.target.value.toUpperCase())} />;
    default: return <input {...comun} />;
  }
}

const mostrar = (campo, v) => (!v ? '—' : campo.tipo === 'fecha' ? fechaLegible(v) : v);

export default function Caso({ id, usuario }) {
  const esNuevo = id === null;
  const [original, setOriginal] = useState(esNuevo ? {} : null);
  const [cambios, setCambios] = useState({});
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [nota, setNota] = useState({});
  const [guardando, setGuardando] = useState(false);

  const recibir = (d) => { setOriginal(d.caso); setHistorial(d.historial); setCambios({}); };
  useEffect(() => {
    if (!esNuevo) api('/casos/' + id).then(recibir).catch((e) => setError(e.message));
  }, [id]);

  const pendientes = Object.keys(cambios).length > 0;
  // Avisa si intenta cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!pendientes) return;
    const avisar = (e) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [pendientes]);

  if (esNuevo && !puedeCrear(usuario.rol)) return <div className="aviso error">Tu rol no puede crear casos nuevos.</div>;
  if (!original) return error ? <div className="aviso error">{error} <a href="#/">Volver a la lista</a></div> : <p className="suave">Cargando caso…</p>;

  const valor = (c) => cambios[c] ?? original[c] ?? '';
  const cambiar = (c, v) => {
    setAviso('');
    setCambios((prev) => {
      const sig = { ...prev, [c]: v };
      if (v === (original[c] ?? '')) delete sig[c];
      return sig;
    });
  };

  // Al salir del código o del número de bus: completa ceros y trae nombre, documento y placa
  const alSalir = async (campo) => {
    if (campo.id === 'codigo_operador') {
      const codigo = codigo4(valor('codigo_operador'));
      if (!codigo) return setNota((n) => ({ ...n, codigo_operador: '' }));
      cambiar('codigo_operador', codigo);
      if (codigo === (original.codigo_operador ?? '')) return;
      const op = await api('/operadores/' + codigo).catch(() => null);
      if (op) { cambiar('nombre_operador', op.nombre); cambiar('cedula_operador', op.cedula); }
      setNota((n) => ({ ...n, codigo_operador: op ? '' : 'No está en el listado de operadores. Escribe el nombre y el documento.' }));
    }
    if (campo.id === 'numero_bus') {
      const numero = valor('numero_bus');
      if (!numero || numero === (original.numero_bus ?? '')) return;
      const bus = await api('/buses/' + numero).catch(() => null);
      if (bus) cambiar('placa_bus', bus.placa);
      setNota((n) => ({ ...n, numero_bus: bus ? '' : 'No está en el listado de buses. Escribe la placa.' }));
    }
  };

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      if (esNuevo) {
        const d = await api('/casos', { metodo: 'POST', datos: cambios });
        setCambios({});
        ir('caso/' + d.caso.id);
      } else {
        recibir(await api('/casos/' + id, { metodo: 'PATCH', datos: cambios }));
        setAviso('Cambios guardados');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const volver = () => { if (!pendientes || confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')) ir(''); };
  const eliminar = async () => {
    if (!confirm(`¿Eliminar definitivamente el caso ${idCaso(id)}? Esta acción no se puede deshacer.`)) return;
    await api('/casos/' + id, { metodo: 'DELETE' }).then(() => ir('')).catch((e) => setError(e.message));
  };

  const secciones = esNuevo ? SECCIONES.filter((s) => puedeEditar(usuario.rol, s.rol)) : SECCIONES;
  const editaAlgo = SECCIONES.some((s) => puedeEditar(usuario.rol, s.rol));

  return (
    <div className="caso">
      <button className="boton fantasma volver" onClick={volver}>← Volver a la lista</button>
      <div className="encabezado">
        <div>
          <h1>{esNuevo ? 'Nuevo caso' : <>Caso <span className="id">{idCaso(id)}</span></>}</h1>
          <p className="suave">
            {esNuevo
              ? 'Ningún campo es obligatorio: llena lo que tengas y completa el resto después. El ID se asigna al guardar.'
              : <>{original.nombre_operador || 'Operador sin registrar'} · {fechaLegible(original.fecha_novedad)} {original.tipo_dano && <Etiqueta valor={original.tipo_dano} />} {original.estado && <Etiqueta valor={original.estado} />}</>}
          </p>
        </div>
        {!esNuevo && usuario.rol === 'ADMIN' && <button className="boton peligro" onClick={eliminar}>Eliminar caso</button>}
      </div>

      {!esNuevo && !editaAlgo && <div className="aviso info">Tu usuario es de solo consulta: puedes ver toda la información, pero no modificarla.</div>}

      {secciones.map((s) => {
        const editable = puedeEditar(usuario.rol, s.rol);
        return (
          <section key={s.id} className={'tarjeta seccion ' + (editable ? 'editable' : 'bloqueada')}>
            <header>
              <h2>{s.titulo}</h2>
              <span className={'permiso ' + (editable ? 'si' : 'no')}>
                {editable ? '✎ Puedes editar' : `🔒 Solo lectura · lo diligencia ${ROLES[s.rol]}`}
              </span>
            </header>
            <div className="campos">
              {s.campos.map((c) => (
                <div key={c.id} className={'campo ancho-' + (c.ancho || 1) + (c.id in cambios ? ' cambiado' : '')}>
                  <label htmlFor={editable ? c.id : undefined}>{c.etiqueta}</label>
                  {editable
                    ? <Entrada campo={c} valor={valor(c.id)} cambiar={(v) => cambiar(c.id, v)} alSalir={() => alSalir(c)} />
                    : <div className={'lectura' + (valor(c.id) ? '' : ' sin-dato')}>{mostrar(c, valor(c.id))}</div>}
                  {editable && (nota[c.id] ? <small className="nota">{nota[c.id]}</small> : c.ayuda && <small className="suave">{c.ayuda}</small>)}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {esNuevo && <div className="aviso info">Después de crear el caso, CMO, SIES24 y Jurídico completan su parte desde sus propios usuarios.</div>}

      {!esNuevo && historial.length > 0 && (
        <details className="tarjeta historial">
          <summary>Historial de cambios ({historial.length})</summary>
          <ul>
            {historial.map((h, i) => (
              <li key={i}><span className="suave">{h.fecha}</span> <strong>{h.usuario}</strong> <span className="suave">({h.rol})</span> — {h.detalle}</li>
            ))}
          </ul>
        </details>
      )}

      {(editaAlgo || esNuevo) && (
        <div className={'guardar' + (pendientes ? ' activo' : '')}>
          <span>
            {error ? <span className="txt-error">{error}</span>
              : pendientes ? `Tienes ${Object.keys(cambios).length} campo(s) sin guardar`
              : aviso ? <span className="txt-ok">✓ {aviso}</span>
              : 'Sin cambios pendientes'}
          </span>
          {pendientes && !esNuevo && <button className="boton fantasma" onClick={() => { setCambios({}); setNota({}); }}>Descartar</button>}
          <button className="boton primario grande" disabled={guardando || (!pendientes && !esNuevo)} onClick={guardar}>
            {guardando ? 'Guardando…' : esNuevo ? 'Crear caso' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}
