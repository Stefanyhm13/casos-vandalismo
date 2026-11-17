import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ordenNatural } from '../../shared/campos.js';

// Pantalla del administrador para mantener las listas que cambian con el tiempo:
//  - Rutas: las opciones del campo "Ruta" de los casos (tabla "rutas").
//  - Buses: número y placa (tabla "buses"); con ellos se completa el otro dato al escribir en un caso.
// Quitar una ruta o un bus solo lo saca de la lista: los casos que ya lo tienen lo conservan.
export default function Listas({ cfg, alCambiar }) {
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const hacer = async (fn) => {
    setError(''); setAviso('');
    try { return await fn(); } catch (e) { setError(e.message); return null; }
  };

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Rutas y buses</h1>
          <p className="suave">Listas que se usan al diligenciar los casos. Lo que agregue o quite aquí se ve de inmediato en el formulario.</p>
          <p className="suave">Quitar una ruta o un bus solo lo saca de la lista: los casos que ya lo tienen lo conservan.</p>
        </div>
      </div>
      {error && <div className="aviso error">{error}</div>}
      {aviso && <div className="aviso ok">{aviso}</div>}
      <div className="listas">
        <Rutas cfg={cfg} alCambiar={alCambiar} hacer={hacer} avisar={setAviso} />
        <Buses hacer={hacer} avisar={setAviso} />
      </div>
    </>
  );
}

function Rutas({ cfg, alCambiar, hacer, avisar }) {
  const rutas = [...(cfg.campos.ruta?.opciones ?? [])].sort(ordenNatural);
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [uso, setUso] = useState({});
  useEffect(() => { api('/rutas/uso').then(setUso).catch(() => {}); }, []);
  const config = (r) => alCambiar({ roles: r.roles, campos: r.campos, rutas: r.rutas });

  const agregar = (e) => {
    e.preventDefault();
    // Se pueden escribir varias a la vez, separadas por coma, espacio o renglón
    const codigos = texto.split(/[\s,;]+/).filter(Boolean);
    hacer(async () => {
      const r = await api('/rutas', { metodo: 'POST', datos: { codigos } });
      config(r);
      setTexto('');
      avisar(r.agregadas.length
        ? `Ruta${r.agregadas.length > 1 ? 's agregadas' : ' agregada'}: ${r.agregadas.join(', ')}`
        : 'Esas rutas ya estaban en la lista');
    });
  };
  const quitar = (ruta) => {
    const n = uso[ruta] ?? 0;
    const detalle = n ? `\n\n${n} ${n === 1 ? 'caso tiene' : 'casos tienen'} esta ruta y la ${n === 1 ? 'conserva' : 'conservan'}.` : '';
    if (!confirm(`¿Quitar la ruta ${ruta} de la lista?${detalle}`)) return;
    hacer(async () => { config(await api('/rutas/' + encodeURIComponent(ruta), { metodo: 'DELETE' })); avisar(`Ruta ${ruta} quitada de la lista`); });
  };
  const visibles = rutas.filter((r) => r.includes(buscar.toUpperCase().trim()));

  return (
    <section className="tarjeta ind-panel">
      <header className="ind-cabeza">
        <div><h2>Rutas</h2><p className="suave">{rutas.length} rutas en la lista</p></div>
      </header>
      <form className="lista-agregar" onSubmit={agregar}>
        <label>
          Agregar rutas
          <input value={texto} onChange={(e) => setTexto(e.target.value.toUpperCase())} placeholder="Ej.: 6026 o varias: 6026, 6027, 6027A" />
        </label>
        <button className="boton primario" disabled={!texto.trim()}>Agregar</button>
      </form>
      <input type="search" className="lista-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar ruta" aria-label="Buscar ruta" />
      <ul className="rutas-lista">
        {visibles.map((r) => (
          <li key={r}>
            <span>{r}{uso[r] ? <small>{uso[r]} {uso[r] === 1 ? 'caso' : 'casos'}</small> : null}</span>
            <button type="button" onClick={() => quitar(r)} title={`Quitar la ruta ${r}`} aria-label={`Quitar la ruta ${r}`}>✕</button>
          </li>
        ))}
        {!visibles.length && <li className="suave sin-borde">{rutas.length ? 'Ninguna ruta coincide' : 'No hay rutas. Agregue la primera arriba.'}</li>}
      </ul>
    </section>
  );
}

function Buses({ hacer, avisar }) {
  const [buses, setBuses] = useState([]);
  const [form, setForm] = useState({ numero: '', placa: '' });
  const [editando, setEditando] = useState(null); // número del bus que se está modificando
  const [buscar, setBuscar] = useState('');
  const cargar = () => api('/buses').then(setBuses).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const guardar = (e) => {
    e.preventDefault();
    hacer(async () => {
      const r = await api('/buses', { metodo: 'POST', datos: form });
      avisar(r.nuevo ? `Bus ${r.numero} agregado con placa ${r.placa}` : `Bus ${r.numero}: placa actualizada a ${r.placa}`);
      setForm({ numero: '', placa: '' });
      setEditando(null);
      await cargar();
    });
  };
  const quitar = (b) => {
    if (!confirm(`¿Quitar el bus ${b.numero} (placa ${b.placa}) del listado?\n\nLos casos que ya lo tienen lo conservan.`)) return;
    hacer(async () => { await api('/buses/' + b.numero, { metodo: 'DELETE' }); avisar(`Bus ${b.numero} quitado del listado`); await cargar(); });
  };
  const editar = (b) => { setEditando(b.numero); setForm({ numero: b.numero, placa: b.placa }); };
  const q = buscar.trim().toUpperCase();
  const visibles = buses.filter((b) => !q || b.numero.includes(q) || String(b.placa).includes(q));

  return (
    <section className="tarjeta ind-panel">
      <header className="ind-cabeza">
        <div><h2>Buses</h2><p className="suave">{buses.length} buses en el listado</p></div>
      </header>
      <form className="lista-agregar" onSubmit={guardar}>
        <label className="corto">
          Número del bus
          <input
            inputMode="numeric" value={form.numero} disabled={!!editando} placeholder="Ej.: 125"
            onChange={(e) => setForm({ ...form, numero: e.target.value.replace(/\D/g, '').slice(0, 9) })}
          />
        </label>
        <label>
          Placa
          <input value={form.placa} placeholder="Ej.: ABC123" onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })} />
        </label>
        <button className="boton primario" disabled={!form.numero || !form.placa}>{editando ? 'Guardar placa' : 'Agregar'}</button>
        {editando && <button type="button" className="boton fantasma" onClick={() => { setEditando(null); setForm({ numero: '', placa: '' }); }}>Cancelar</button>}
      </form>
      {editando && <p className="suave nota-edicion">Modificando el bus {editando}: escriba la placa nueva.</p>}
      <input type="search" className="lista-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por número o placa" aria-label="Buscar bus" />
      <div className="tabla-caja buses-tabla">
        <table className="sin-clic">
          <thead><tr><th>Número</th><th>Placa</th><th /></tr></thead>
          <tbody>
            {visibles.map((b) => (
              <tr key={b.numero} className={editando === b.numero ? 'marcado' : ''}>
                <td><strong>{b.numero}</strong></td>
                <td>{b.placa || '—'}</td>
                <td className="acciones">
                  <button type="button" className="boton fantasma" onClick={() => editar(b)}>Cambiar placa</button>
                  <button type="button" className="boton peligro" onClick={() => quitar(b)}>Quitar</button>
                </td>
              </tr>
            ))}
            {!visibles.length && <tr><td colSpan={3} className="suave">{buses.length ? 'Ningún bus coincide' : 'No hay buses en el listado.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
