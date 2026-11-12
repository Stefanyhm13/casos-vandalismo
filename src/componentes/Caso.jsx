import { Fragment, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ir } from '../App.jsx';
import { Etiqueta, fechaLegible } from './Lista.jsx';
import FotoOperador from './FotoOperador.jsx';
import { CampoFecha, CampoHora } from './CampoFecha.jsx';
import { idCaso, codigo4, soloDigitos, NA, sinDato } from '../../shared/campos.js';

// Un campo editable. Las fechas y las horas usan los selectores propios de la app.
function Entrada({ campo, valor, cambiar, alSalir, lista }) {
  const comun = { id: campo.id, value: valor, onChange: (e) => cambiar(e.target.value), onBlur: alSalir, list: lista, autoComplete: lista ? 'off' : undefined };
  switch (campo.tipo) {
    case 'fecha': return <CampoFecha id={campo.id} value={valor} onChange={cambiar} />;
    case 'hora': return <CampoHora id={campo.id} value={valor} onChange={cambiar} />;
    case 'area': return <textarea rows={3} {...comun} />;
    case 'opcion':
      return (
        <select {...comun}>
          <option value="">Sin diligenciar</option>
          {campo.opciones.map((o) => <option key={o}>{o}</option>)}
          <option>{NA}</option>
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
// "2026-09-22 06:00:00" -> "22/09/2026 06:00"
const fechaHora = (v) => {
  const [f, h] = String(v ?? '').split(' ');
  return f ? fechaLegible(f) + (h ? ' ' + h.slice(0, 5) : '') : '—';
};
const soloPlaca = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const sinCeros = (v) => (soloDigitos(v) ? String(Number(soloDigitos(v))) : '');

// Opción desplegable con todos los casos del mismo operador. Cada uno abre en una pestaña nueva.
function CasosOperador({ id }) {
  const [casos, setCasos] = useState(null);
  useEffect(() => { api('/casos/' + id + '/operador').then(setCasos).catch(() => setCasos(null)); }, [id]);
  if (!casos) return null;
  return (
    <details className="del-operador">
      <summary>Cantidad de casos del operador: <strong>{casos.length}</strong></summary>
      <ul>
        {casos.map((c) => (
          <li key={c.id}>
            <a href={'#/caso/' + c.id} target="_blank" rel="noopener" title="Abrir este caso en una pestaña nueva">
              <strong className="id">{idCaso(c.id)}</strong>
              <Etiqueta valor={c.tipo_dano} />
              <span className="suave">{fechaLegible(c.fecha_novedad)}</span>
              {String(c.id) === String(id) ? <span className="suave">· este caso</span> : <span className="abrir">Abrir ↗</span>}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function Caso({ id, usuario, cfg }) {
  const esNuevo = id === null;
  const [original, setOriginal] = useState(esNuevo ? {} : null);
  const [cambios, setCambios] = useState({});
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [nota, setNota] = useState({});
  const [guardando, setGuardando] = useState(false);
  // Listado de buses para sugerir número y placa mientras se escribe
  const [buses, setBuses] = useState([]);
  useEffect(() => { api('/buses').then(setBuses).catch(() => {}); }, []);
  const puestoSolo = useRef({}); // lo último que la app completó sola en número o placa

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

  if (esNuevo && !cfg.puedeCrear(usuario.rol)) return <div className="aviso error">Su rol no puede crear casos nuevos.</div>;
  if (!original) return error ? <div className="aviso error">{error} <a href="#/">Volver a la lista</a></div> : <p className="suave">Cargando caso…</p>;

  const valor = (c) => cambios[c] ?? original[c] ?? '';
  // Para el encabezado: un dato marcado como N/A cuenta como si no estuviera
  const dato = (c) => (sinDato(valor(c)) ? '' : valor(c));
  const cambiar = (c, v) => {
    setAviso('');
    setCambios((prev) => {
      const sig = { ...prev, [c]: v };
      if (v === (original[c] ?? '')) delete sig[c];
      return sig;
    });
  };

  // Número y placa del bus van enlazados: al escribir o elegir uno de la lista, se completa el otro.
  const enlazar = (otro, encontrado) => {
    if (encontrado) {
      puestoSolo.current[otro] = encontrado;
      cambiar(otro, encontrado);
    } else if (puestoSolo.current[otro] && valor(otro) === puestoSolo.current[otro]) {
      // Lo escrito ya no coincide con ningún bus: se quita lo que se había completado solo
      puestoSolo.current[otro] = null;
      cambiar(otro, original[otro] ?? '');
    }
  };
  const alCambiar = (campo, v) => {
    cambiar(campo.id, v);
    if (campo.id === 'numero_bus') enlazar('placa_bus', buses.find((b) => b.numero === sinCeros(v))?.placa);
    if (campo.id === 'placa_bus') enlazar('numero_bus', buses.find((b) => b.placa === soloPlaca(v))?.numero);
  };
  const LISTAS = { numero_bus: 'lista-numeros-bus', placa_bus: 'lista-placas-bus' };

  // Al salir del código del operador: completa ceros y trae nombre y documento
  const alSalir = async (campo) => {
    if (campo.id === 'codigo_operador') {
      const codigo = codigo4(valor('codigo_operador'));
      if (!codigo) return setNota((n) => ({ ...n, codigo_operador: '' }));
      cambiar('codigo_operador', codigo);
      if (codigo === (original.codigo_operador ?? '')) return;
      const op = await api('/operadores/' + codigo).catch(() => null);
      if (op) { cambiar('nombre_operador', op.nombre); cambiar('cedula_operador', op.cedula); }
      setNota((n) => ({ ...n, codigo_operador: op ? '' : 'No está en el listado de operadores. Escriba el nombre y el documento.' }));
    }
    // Al salir del documento: trae el código y el nombre del operador
    if (campo.id === 'cedula_operador') {
      const cedula = valor('cedula_operador').replace(/\D/g, '');
      if (cedula.length < 5 || cedula === (original.cedula_operador ?? '')) return setNota((n) => ({ ...n, cedula_operador: '' }));
      const op = await api('/operadores/cedula/' + cedula).catch(() => null);
      if (op?.codigo) cambiar('codigo_operador', op.codigo);
      if (op?.nombre) cambiar('nombre_operador', op.nombre);
      setNota((n) => ({ ...n, cedula_operador: op ? '' : 'No se encontró este documento. Escriba el código y el nombre.', ...(op?.codigo ? { codigo_operador: '' } : {}) }));
    }
    if (campo.id === 'numero_bus') {
      const numero = sinCeros(valor('numero_bus'));
      const bus = buses.find((b) => b.numero === numero);
      if (bus) cambiar('numero_bus', numero); // "001" queda como "1", igual que en el listado
      setNota((n) => ({ ...n, numero_bus: !numero || bus || !buses.length ? '' : 'No está en el listado de buses. Escriba la placa.' }));
    }
    if (campo.id === 'placa_bus') {
      const placa = soloPlaca(valor('placa_bus'));
      const bus = buses.find((b) => b.placa === placa);
      if (bus) cambiar('placa_bus', placa);
      setNota((n) => ({ ...n, placa_bus: !placa || bus || !buses.length ? '' : 'No está en el listado de buses. Escriba el número.' }));
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

  const volver = () => { if (!pendientes || confirm('Tiene cambios sin guardar. ¿Desea salir de todas formas?')) ir(''); };
  const eliminar = async () => {
    if (!confirm(`¿Eliminar definitivamente el caso ${idCaso(id)}? Esta acción no se puede deshacer.`)) return;
    await api('/casos/' + id, { metodo: 'DELETE' }).then(() => ir('')).catch((e) => setError(e.message));
  };

  // Los permisos son por campo: un rol puede editar solo algunos campos de una sección.
  const edita = (c) => cfg.puedeEditar(usuario.rol, c.id);
  // En un caso nuevo solo se muestran los campos que este usuario puede llenar.
  const secciones = cfg.secciones
    .map((s) => (esNuevo ? { ...s, campos: s.campos.filter(edita) } : s))
    .filter((s) => s.campos.length);
  const editaAlgo = secciones.some((s) => s.campos.some(edita));
  // Campos que esta persona puede llenar y están vacíos: al guardar quedan como N/A
  const vacios = secciones.flatMap((s) => s.campos).filter((c) => edita(c) && !valor(c.id)).length;

  return (
    <div className="caso">
      <button className="boton fantasma volver" onClick={volver}>← Volver a la lista</button>
      <div className="encabezado tarjeta ficha">
        <FotoOperador cedula={dato('cedula_operador')} nombre={dato('nombre_operador')} />
        <div className="ficha-datos">
          <h1>{esNuevo ? 'Nuevo caso' : <>Caso <span className="id">{idCaso(id)}</span></>}</h1>
          <p className="operador">{dato('nombre_operador') || 'Operador sin registrar'}</p>
          <p className="suave">
            {[dato('codigo_operador') && 'Código ' + dato('codigo_operador'), dato('cedula_operador') && 'Documento ' + dato('cedula_operador')].filter(Boolean).join(' · ')}
            {!esNuevo && <> {!sinDato(original.tipo_dano) && <Etiqueta valor={original.tipo_dano} />} {!sinDato(original.estado) && <Etiqueta valor={original.estado} />}</>}
          </p>
          {!esNuevo && <CasosOperador key={(original.cedula_operador || '') + '/' + (original.codigo_operador || '')} id={id} />}
          {esNuevo && <p className="suave">Ningún campo es obligatorio: diligencie lo que tenga. Los campos que deje vacíos quedan como N/A y se pueden corregir después. El ID se asigna al guardar.</p>}
        </div>
        {!esNuevo && usuario.rol === 'ADMIN' && <button className="boton peligro" onClick={eliminar}>Eliminar caso</button>}
      </div>

      {!esNuevo && !editaAlgo && <div className="aviso info">Su usuario es de solo consulta: puede ver toda la información, pero no modificarla.</div>}

      {secciones.map((s) => {
        const cuantos = s.campos.filter(edita).length;
        return (
          <section key={s.id} className={'tarjeta seccion ' + (cuantos ? 'editable' : 'bloqueada')}>
            <header>
              <h2>{s.titulo}</h2>
              <span className={'permiso ' + (cuantos ? 'si' : 'no')}>
                {cuantos === s.campos.length ? '✎ Puede editar'
                  : cuantos ? `✎ Puede editar ${cuantos} de ${s.campos.length} campos`
                  : `🔒 Solo lectura · lo diligencia ${cfg.roles[s.rol]}`}
              </span>
            </header>
            <div className="campos">
              {s.campos.map((c) => { const editable = edita(c); return (<Fragment key={c.id}>
                <div className={'campo ancho-' + (c.ancho || 1) + (c.id in cambios ? ' cambiado' : '')}>
                  <label htmlFor={editable ? c.id : undefined}>{c.etiqueta}</label>
                  {editable
                    ? <Entrada campo={c} valor={valor(c.id)} cambiar={(v) => alCambiar(c, v)} alSalir={() => alSalir(c)} lista={LISTAS[c.id]} />
                    : <div className={'lectura' + (valor(c.id) ? '' : ' sin-dato')}>{mostrar(c, valor(c.id))}</div>}
                  {editable && (nota[c.id] ? <small className="nota">{nota[c.id]}</small> : c.ayuda && <small className="suave">{c.ayuda}</small>)}
                </div>
                {c.id === 'tipo_dano' && !esNuevo && (
                  <div className="campo">
                    <label>Fecha de creación del caso</label>
                    <div className="lectura">{fechaHora(original.creado_en)}</div>
                    <small className="suave">🔒 Se registra sola al crear el caso</small>
                  </div>
                )}
              </Fragment>); })}
            </div>
          </section>
        );
      })}

      <datalist id="lista-numeros-bus">{buses.map((b) => <option key={b.numero} value={b.numero} label={'Placa ' + b.placa} />)}</datalist>
      <datalist id="lista-placas-bus">{buses.map((b) => <option key={b.numero} value={b.placa} label={'Bus ' + b.numero} />)}</datalist>

      {esNuevo && <div className="aviso info">Después de crear el caso, las demás áreas completan su parte desde sus propios usuarios.</div>}

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
              : pendientes ? `Tiene ${Object.keys(cambios).length} campo(s) sin guardar`
              : aviso ? <span className="txt-ok">✓ {aviso}</span>
              : 'Sin cambios pendientes'}
            {vacios > 0 && <small className="suave">Al guardar, {vacios === 1 ? 'el campo que deje vacío quedará' : `los ${vacios} campos que deje vacíos quedarán`} como N/A.</small>}
          </span>
          {pendientes && !esNuevo && <button className="boton fantasma" onClick={() => { setCambios({}); setNota({}); }}>Descartar</button>}
          <button className="boton primario grande" disabled={guardando || (!pendientes && !esNuevo && !vacios)} onClick={guardar}>
            {guardando ? 'Guardando…' : esNuevo ? 'Crear caso' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}
