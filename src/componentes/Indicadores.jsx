import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { ir } from '../App.jsx';
import { CAMPOS, idCaso } from '../../shared/campos.js';
import { Etiqueta, fechaLegible } from './Lista.jsx';

// Pestaña Indicadores: cantidad de casos por mes (total, por ruta, por tipo de daño, por
// responsabilidad y por estado) y casos abiertos por cada proceso responsable, es decir, casos
// a los que les falta información que debe llenar ese rol. Todo se calcula en el navegador a partir
// de /api/indicadores, así los filtros y los clics en las gráficas responden de inmediato.

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const dos = (n) => String(n).padStart(2, '0');
const mesLargo = (m) => MESES_LARGOS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
const sumarMes = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1); return d.getFullYear() + '-' + dos(d.getMonth() + 1); };
const rangoMeses = (a, b) => { const r = []; for (let m = a; m <= b && r.length < 240; m = sumarMes(m, 1)) r.push(m); return r; };
const mesHoy = () => { const d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1); };
const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0).toLocaleString('es-CO') + '%';
const cantidad = (n) => n.toLocaleString('es-CO');

// Colores. Las categorías conservan su color aunque cambien los filtros (el color es de la
// categoría, no de su puesto). Tipo de daño y estado usan los mismos colores de las etiquetas de la app.
const CATEGORICA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
const SIN_DATO = '#cdd5d0';
const OTRAS = '#8d9a92';
const VERDE = '#25a055';
const TODAS = '*';

const DIMENSIONES = {
  ruta: { titulo: 'Ruta', vacio: 'Sin ruta' },
  tipo: { titulo: 'Tipo de daño', vacio: 'Sin clasificar', orden: CAMPOS.tipo_dano.opciones, colores: { Leve: '#25a055', Grave: '#eda100', Gravísimo: '#c62828' } },
  resp: { titulo: 'Responsabilidad', vacio: 'Sin definir', orden: CAMPOS.responsabilidad.opciones, colores: { Interno: '#2a78d6', Externo: '#eb6834' } },
  estado: { titulo: 'Estado', vacio: 'Sin estado', orden: CAMPOS.estado.opciones, colores: { Abierto: '#2a78d6', Pendiente: '#eda100', Cerrado: '#1baf7a' } },
};
const DESGLOSES = { total: 'Total general', ruta: 'Por ruta', tipo: 'Por tipo de daño', resp: 'Por responsabilidad', estado: 'Por estado' };
const RUTAS_CON_COLOR = CATEGORICA.length;

const FILTROS_INICIALES = { desde: '', hasta: '', mes: '', ruta: TODAS, tipo: TODAS, resp: TODAS, estado: TODAS, proceso: TODAS };

// ¿El caso cumple los filtros? "excepto" deja por fuera uno de ellos: así cada gráfica muestra
// todas sus categorías (resaltando la elegida) en lugar de quedar con una sola barra.
function cumple(c, f, excepto) {
  const m = c.fecha.slice(0, 7);
  if ((f.desde || f.hasta) && excepto !== 'periodo') {
    if (!m || (f.desde && m < f.desde) || (f.hasta && m > f.hasta)) return false;
  }
  if (f.mes && excepto !== 'mes' && excepto !== 'periodo' && m !== f.mes) return false;
  for (const k of Object.keys(DIMENSIONES)) if (k !== excepto && f[k] !== TODAS && c[k] !== f[k]) return false;
  if (excepto !== 'proceso' && f.proceso !== TODAS && !c.pend.includes(f.proceso)) return false;
  return true;
}

export default function Indicadores() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [f, setF] = useState(FILTROS_INICIALES);
  const [desglose, setDesglose] = useState('total');
  const [verTabla, setVerTabla] = useState(false);
  const [todasRutas, setTodasRutas] = useState(false);
  const [cuantosVer, setCuantosVer] = useState(25);
  const [actualizado, setActualizado] = useState(null);

  const cargar = () => api('/indicadores')
    .then((d) => { setDatos(d); setError(''); setActualizado(new Date()); })
    .catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  const poner = (cambio) => { setF((prev) => ({ ...prev, ...cambio })); setCuantosVer(25); };
  const casos = datos?.casos ?? [];
  const procesos = datos?.procesos ?? [];

  // Categorías de cada dimensión con su color fijo. Las rutas se ordenan por cantidad total de casos.
  const categorias = useMemo(() => {
    const r = {};
    for (const [k, d] of Object.entries(DIMENSIONES)) {
      const hay = new Map();
      for (const c of casos) hay.set(c[k], (hay.get(c[k]) ?? 0) + 1);
      let valores;
      if (d.orden) valores = [...d.orden, ...[...hay.keys()].filter((v) => v && !d.orden.includes(v))];
      else valores = [...hay.keys()].filter(Boolean).sort((a, b) => hay.get(b) - hay.get(a) || a.localeCompare(b));
      if (hay.has('')) valores.push('');
      r[k] = valores.map((v, i) => ({
        valor: v,
        etiqueta: v || d.vacio,
        color: !v ? SIN_DATO : d.colores?.[v] ?? (k === 'ruta' ? (i < RUTAS_CON_COLOR ? CATEGORICA[i] : OTRAS) : CATEGORICA[i % CATEGORICA.length]),
      }));
    }
    return r;
  }, [casos]);

  const meses = useMemo(() => [...new Set(casos.filter((c) => c.fecha).map((c) => c.fecha.slice(0, 7)))].sort(), [casos]);
  const opcionesMes = [...new Set([...meses, f.desde, f.hasta].filter(Boolean))].sort();
  const filtrados = useMemo(() => casos.filter((c) => cumple(c, f)), [casos, f]);

  // ---- Casos por mes ----
  const porMes = useMemo(() => {
    const base = casos.filter((c) => cumple(c, f, 'mes'));
    const conFecha = base.filter((c) => c.fecha);
    if (!conFecha.length) return { eje: [], base, sinFecha: base.length };
    const primero = f.desde || conFecha.reduce((a, c) => (c.fecha < a ? c.fecha : a), '9999').slice(0, 7);
    const ultimo = f.hasta || conFecha.reduce((a, c) => (c.fecha > a ? c.fecha : a), '0000').slice(0, 7);
    const eje = rangoMeses(primero, ultimo).map((m) => ({ mes: m, casos: conFecha.filter((c) => c.fecha.startsWith(m)) }));
    return { eje, base, sinFecha: base.length - conFecha.length };
  }, [casos, f]);

  // Series del desglose elegido. En "por ruta" las rutas sin color propio se juntan en "Otras rutas".
  const series = useMemo(() => {
    if (desglose === 'total') return [{ valor: null, etiqueta: 'Casos', color: VERDE, es: () => true }];
    const cats = categorias[desglose] ?? [];
    if (desglose !== 'ruta' || cats.length <= RUTAS_CON_COLOR + 1) return cats.map((c) => ({ ...c, es: (x) => x[desglose] === c.valor }));
    const propias = cats.filter((c) => c.valor && c.color !== OTRAS);
    const otras = new Set(cats.filter((c) => c.valor && c.color === OTRAS).map((c) => c.valor));
    return [
      ...propias.map((c) => ({ ...c, es: (x) => x.ruta === c.valor })),
      { valor: '__otras', etiqueta: `Otras rutas (${otras.size})`, color: OTRAS, es: (x) => otras.has(x.ruta) },
      ...(cats.some((c) => !c.valor) ? [{ valor: '', etiqueta: 'Sin ruta', color: SIN_DATO, es: (x) => !x.ruta }] : []),
    ];
  }, [desglose, categorias]);

  // ---- Conteos por dimensión (cada una sin su propio filtro) ----
  const conteo = (k) => {
    const base = casos.filter((c) => cumple(c, f, k));
    return { total: base.length, filas: (categorias[k] ?? []).map((cat) => ({ ...cat, n: base.filter((c) => c[k] === cat.valor).length })) };
  };
  const procesoConteo = useMemo(() => {
    const base = casos.filter((c) => cumple(c, f, 'proceso'));
    return { total: base.length, filas: procesos.map((p, i) => ({ valor: p.id, etiqueta: p.nombre, color: CATEGORICA[i % CATEGORICA.length], n: base.filter((c) => c.pend.includes(p.id)).length })) };
  }, [casos, f, procesos]);

  if (error && !datos) return <div className="aviso error">{error}</div>;
  if (!datos) return <p className="suave">Cargando indicadores…</p>;

  // ---- Tarjetas de resumen ----
  const total = filtrados.length;
  const mesRef = f.mes || porMes.eje.at(-1)?.mes || '';
  const delMes = (m) => porMes.base.filter((c) => c.fecha.startsWith(m)).length;
  const nMes = mesRef ? delMes(mesRef) : 0;
  const nAnterior = mesRef ? delMes(sumarMes(mesRef, -1)) : 0;
  const variacion = nAnterior ? Math.round(((nMes - nAnterior) / nAnterior) * 100) : null;
  const gravisimos = filtrados.filter((c) => c.tipo === 'Gravísimo').length;
  const internos = filtrados.filter((c) => c.resp === 'Interno').length;
  const externos = filtrados.filter((c) => c.resp === 'Externo').length;
  const abiertos = filtrados.filter((c) => c.pend.length).length;

  // ---- Filtros activos ----
  const nombreDe = (k, v) => categorias[k]?.find((c) => c.valor === v)?.etiqueta ?? v;
  const activos = [
    (f.desde || f.hasta) && { texto: 'Periodo: ' + (f.desde ? mesLargo(f.desde) : 'inicio') + ' – ' + (f.hasta ? mesLargo(f.hasta) : 'hoy'), quitar: { desde: '', hasta: '' } },
    f.mes && { texto: 'Mes: ' + mesLargo(f.mes), quitar: { mes: '' } },
    ...Object.keys(DIMENSIONES).filter((k) => f[k] !== TODAS).map((k) => ({ texto: DIMENSIONES[k].titulo + ': ' + nombreDe(k, f[k]), quitar: { [k]: TODAS } })),
    f.proceso !== TODAS && { texto: 'Pendiente de: ' + (procesos.find((p) => p.id === f.proceso)?.nombre ?? f.proceso), quitar: { proceso: TODAS } },
  ].filter(Boolean);

  const atajo = (nombre) => {
    const hoy = mesHoy();
    const rangos = { todo: ['', ''], anio: [hoy.slice(0, 4) + '-01', ''], doce: [sumarMes(hoy, -11), ''], tres: [sumarMes(hoy, -2), ''] };
    const [desde, hasta] = rangos[nombre];
    poner({ desde, hasta, mes: '' });
  };
  const atajoActivo = (() => {
    const hoy = mesHoy();
    if (f.hasta) return '';
    if (!f.desde) return 'todo';
    return { [hoy.slice(0, 4) + '-01']: 'anio', [sumarMes(hoy, -11)]: 'doce', [sumarMes(hoy, -2)]: 'tres' }[f.desde] ?? '';
  })();

  // ---- Tabla mes a mes y descarga ----
  const columnasTabla = desglose === 'total' ? [] : series;
  const filasTabla = porMes.eje.map((m) => ({ mes: m.mes, valores: columnasTabla.map((s) => m.casos.filter(s.es).length), total: m.casos.length }));
  const descargarTabla = () => {
    const sep = ';';
    const lineas = [
      ['Mes', ...columnasTabla.map((s) => s.etiqueta), 'Total'],
      ...filasTabla.map((r) => [mesLargo(r.mes), ...r.valores, r.total]),
      ['Total', ...columnasTabla.map((_, i) => filasTabla.reduce((a, r) => a + r.valores[i], 0)), filasTabla.reduce((a, r) => a + r.total, 0)],
    ];
    const texto = '﻿' + lineas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(sep)).join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: `indicadores-casos-por-mes-${new Date().toLocaleDateString('sv')}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const rutas = conteo('ruta');
  const rutasVisibles = todasRutas ? rutas.filas : rutas.filas.filter((r) => r.n > 0 || r.valor === f.ruta).slice(0, 10);
  const nombreProceso = Object.fromEntries(procesos.map((p) => [p.id, p.nombre]));
  const detalle = [...filtrados].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.id - a.id);

  return (
    <div className="indicadores">
      <div className="encabezado">
        <div>
          <h1>Indicadores</h1>
          <p className="suave">Haga clic en cualquier barra para filtrar todo el tablero. Vuelva a hacer clic para quitar el filtro.</p>
        </div>
        <div className="acciones-lista">
          <span className="suave actualizado">{actualizado && 'Actualizado ' + actualizado.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
          <button className="boton fantasma" onClick={cargar}>↻ Actualizar</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="tarjeta filtros ind-filtros">
        <div className="ind-atajos" role="group" aria-label="Periodo rápido">
          {[['todo', 'Todo'], ['anio', 'Este año'], ['doce', 'Últimos 12 meses'], ['tres', 'Últimos 3 meses']].map(([k, t]) => (
            <button key={k} type="button" className={'chip' + (atajoActivo === k ? ' activo' : '')} aria-pressed={atajoActivo === k} onClick={() => atajo(k)}>{t}</button>
          ))}
        </div>
        <label className="f-corto">
          Desde
          <select value={f.desde} onChange={(e) => poner({ desde: e.target.value, mes: '' })}>
            <option value="">El inicio</option>
            {opcionesMes.map((m) => <option key={m} value={m}>{mesLargo(m)}</option>)}
          </select>
        </label>
        <label className="f-corto">
          Hasta
          <select value={f.hasta} onChange={(e) => poner({ hasta: e.target.value, mes: '' })}>
            <option value="">Hoy</option>
            {opcionesMes.map((m) => <option key={m} value={m}>{mesLargo(m)}</option>)}
          </select>
        </label>
        {Object.entries(DIMENSIONES).map(([k, d]) => (
          <label key={k} className="f-corto">
            {d.titulo}
            <select value={f[k]} onChange={(e) => poner({ [k]: e.target.value })}>
              <option value={TODAS}>Todos</option>
              {(categorias[k] ?? []).map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
            </select>
          </label>
        ))}
        <label className="f-corto">
          Pendiente de
          <select value={f.proceso} onChange={(e) => poner({ proceso: e.target.value })}>
            <option value={TODAS}>Cualquiera</option>
            {procesos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      </div>
      {activos.length > 0 && (
        <div className="ind-activos">
          <span className="suave">Filtros:</span>
          {activos.map((a) => (
            <button key={a.texto} type="button" className="chip activo" onClick={() => poner(a.quitar)} title="Quitar este filtro">{a.texto} <span aria-hidden="true">✕</span></button>
          ))}
          <button type="button" className="boton fantasma" onClick={() => poner(FILTROS_INICIALES)}>Limpiar todo</button>
        </div>
      )}
      {error && <div className="aviso error">{error}</div>}

      {/* Resumen */}
      <div className="ind-kpis">
        <Kpi titulo="Casos" valor={cantidad(total)} nota={total === casos.length ? 'Todos los casos registrados' : `de ${cantidad(casos.length)} registrados`} />
        <Kpi
          titulo={mesRef ? mesLargo(mesRef) : 'Último mes'} valor={cantidad(nMes)}
          nota={variacion === null ? (mesRef ? 'Sin casos el mes anterior' : 'Sin fechas registradas') : `${variacion > 0 ? '▲' : variacion < 0 ? '▼' : '='} ${Math.abs(variacion)}% frente a ${mesLargo(sumarMes(mesRef, -1)).toLowerCase()} (${nAnterior})`}
          tono={variacion > 0 ? 'sube' : variacion < 0 ? 'baja' : ''}
        />
        <Kpi titulo="Gravísimos" valor={cantidad(gravisimos)} nota={pct(gravisimos, total) + ' de los casos'} onClick={() => poner({ tipo: f.tipo === 'Gravísimo' ? TODAS : 'Gravísimo' })} activo={f.tipo === 'Gravísimo'} />
        <Kpi titulo="Responsabilidad interna" valor={cantidad(internos)} nota={`${pct(internos, total)} · externa: ${cantidad(externos)} (${pct(externos, total)})`} onClick={() => poner({ resp: f.resp === 'Interno' ? TODAS : 'Interno' })} activo={f.resp === 'Interno'} />
        <Kpi titulo="Con información pendiente" valor={cantidad(abiertos)} nota={pct(abiertos, total) + ' de los casos tienen campos por llenar'} />
      </div>

      {/* Casos por mes */}
      <section className="tarjeta ind-panel">
        <header className="ind-cabeza">
          <div>
            <h2>Cantidad de casos por mes</h2>
            <p className="suave">{DESGLOSES[desglose]}{f.mes ? ' · mes elegido: ' + mesLargo(f.mes) : ''}</p>
          </div>
          <div className="segmentos" role="group" aria-label="Desglose">
            {Object.entries(DESGLOSES).map(([k, t]) => (
              <button key={k} type="button" className={desglose === k ? 'activo' : ''} aria-pressed={desglose === k} onClick={() => setDesglose(k)}>{t.replace('Por ', '').replace(/^./, (x) => x.toUpperCase())}</button>
            ))}
          </div>
        </header>
        {porMes.eje.length ? (
          <>
            <GraficaMeses eje={porMes.eje} series={series} elegido={f.mes} alElegir={(m) => poner({ mes: f.mes === m ? '' : m })} />
            {series.length > 1 && (
              <ul className="leyenda">
                {series.map((s) => {
                  const filtro = desglose !== 'total' && s.valor !== '__otras';
                  const elegida = filtro && f[desglose] === s.valor;
                  return (
                    <li key={s.etiqueta}>
                      <button type="button" disabled={!filtro} className={elegida ? 'elegida' : ''} onClick={() => poner({ [desglose]: elegida ? TODAS : s.valor })} title={filtro ? 'Filtrar por ' + s.etiqueta : undefined}>
                        <i style={{ background: s.color }} />{s.etiqueta}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : <p className="suave ind-vacio">No hay casos con fecha para los filtros elegidos.</p>}
        <footer className="ind-pie">
          <span className="suave">{porMes.sinFecha > 0 && `${porMes.sinFecha} ${porMes.sinFecha === 1 ? 'caso no tiene' : 'casos no tienen'} fecha de la novedad y no aparecen en la gráfica.`}</span>
          <button type="button" className="boton fantasma" onClick={() => setVerTabla(!verTabla)} aria-expanded={verTabla}>{verTabla ? 'Ocultar tabla' : 'Ver tabla'}</button>
          <button type="button" className="boton fantasma" disabled={!filasTabla.length} onClick={descargarTabla}>Descargar tabla (Excel)</button>
        </footer>
        {verTabla && filasTabla.length > 0 && (
          <div className="tabla-caja ind-tabla">
            <table className="sin-clic">
              <thead><tr><th>Mes</th>{columnasTabla.map((s) => <th key={s.etiqueta} className="num">{s.etiqueta}</th>)}<th className="num">Total</th></tr></thead>
              <tbody>
                {filasTabla.map((r) => (
                  <tr key={r.mes} className={f.mes === r.mes ? 'marcado' : ''}>
                    <td>{mesLargo(r.mes)}</td>{r.valores.map((v, i) => <td key={i} className="num">{v || <span className="suave">0</span>}</td>)}<td className="num"><strong>{r.total}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>Total</td>{columnasTabla.map((s, i) => <td key={s.etiqueta} className="num">{filasTabla.reduce((a, r) => a + r.valores[i], 0)}</td>)}<td className="num">{filasTabla.reduce((a, r) => a + r.total, 0)}</td></tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="ind-rejilla">
        <section className="tarjeta ind-panel">
          <header className="ind-cabeza">
            <div><h2>Casos abiertos por proceso responsable</h2><p className="suave">Casos a los que les falta información que debe llenar cada proceso</p></div>
          </header>
          <Barras {...procesoConteo} elegido={f.proceso} alElegir={(v) => poner({ proceso: v })} />
        </section>
        <section className="tarjeta ind-panel">
          <header className="ind-cabeza"><div><h2>Por tipo de daño</h2></div></header>
          <Barras {...conteo('tipo')} elegido={f.tipo} alElegir={(v) => poner({ tipo: v })} />
        </section>
        <section className="tarjeta ind-panel">
          <header className="ind-cabeza"><div><h2>Por responsabilidad</h2></div></header>
          <Barras {...conteo('resp')} elegido={f.resp} alElegir={(v) => poner({ resp: v })} />
        </section>
        <section className="tarjeta ind-panel">
          <header className="ind-cabeza"><div><h2>Por estado</h2></div></header>
          <Barras {...conteo('estado')} elegido={f.estado} alElegir={(v) => poner({ estado: v })} />
        </section>
        <section className="tarjeta ind-panel ancho-total">
          <header className="ind-cabeza">
            <div><h2>Por ruta</h2><p className="suave">{todasRutas ? 'Todas las rutas' : 'Las 10 rutas con más casos'}</p></div>
            {rutas.filas.length > 10 && <button type="button" className="boton fantasma" onClick={() => setTodasRutas(!todasRutas)}>{todasRutas ? 'Ver solo 10' : `Ver todas (${rutas.filas.length})`}</button>}
          </header>
          {rutas.filas.length ? <Barras total={rutas.total} filas={rutasVisibles} elegido={f.ruta} alElegir={(v) => poner({ ruta: v })} />
            : <p className="suave ind-vacio">Todavía no hay casos con ruta registrada.</p>}
        </section>
      </div>

      {/* Casos que cumplen los filtros */}
      <section className="tarjeta ind-panel">
        <header className="ind-cabeza">
          <div><h2>Casos que cumplen los filtros</h2><p className="suave">{cantidad(total)} {total === 1 ? 'caso' : 'casos'} · clic en uno para abrirlo</p></div>
        </header>
        {detalle.length ? (
          <div className="tabla-caja">
            <table>
              <thead><tr><th>ID</th><th>Fecha</th><th>Ruta</th><th>Operador</th><th>Daño</th><th>Responsabilidad</th><th>Pendiente de</th></tr></thead>
              <tbody>
                {detalle.slice(0, cuantosVer).map((c) => (
                  <tr key={c.id} tabIndex={0} onClick={() => ir('caso/' + c.id)} onKeyDown={(e) => e.key === 'Enter' && ir('caso/' + c.id)}>
                    <td><strong className="id">{idCaso(c.id)}</strong></td>
                    <td>{fechaLegible(c.fecha)}</td>
                    <td>{c.ruta || '—'}</td>
                    <td>{c.operador || '—'}</td>
                    <td><Etiqueta valor={c.tipo} /></td>
                    <td>{c.resp || '—'}</td>
                    <td>{c.pend.length ? <span className="ind-pend">{c.pend.map((p) => <span key={p} className="etiqueta">{nombreProceso[p] ?? p}</span>)}</span> : <span className="etiqueta e-cerrado">Completo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detalle.length > cuantosVer && <div className="ind-mas"><button type="button" className="boton fantasma" onClick={() => setCuantosVer(cuantosVer + 50)}>Ver 50 más ({detalle.length - cuantosVer} restantes)</button></div>}
          </div>
        ) : <p className="suave ind-vacio">Ningún caso cumple los filtros elegidos.</p>}
      </section>
    </div>
  );
}

function Kpi({ titulo, valor, nota, tono = '', onClick, activo }) {
  const Etq = onClick ? 'button' : 'div';
  return (
    <Etq type={onClick ? 'button' : undefined} className={'tarjeta kpi' + (onClick ? ' clic' : '') + (activo ? ' activo' : '')} onClick={onClick} aria-pressed={onClick ? !!activo : undefined}>
      <span className="kpi-titulo">{titulo}</span>
      <strong className="kpi-valor">{valor}</strong>
      <small className={'kpi-nota ' + tono}>{nota}</small>
    </Etq>
  );
}

// Barras horizontales: nombre, barra, cantidad y porcentaje. Clic = filtrar por esa categoría.
function Barras({ filas, total, elegido, alElegir }) {
  const max = Math.max(1, ...filas.map((x) => x.n));
  return (
    <ul className="barras">
      {filas.map((x) => {
        const estado = elegido === TODAS ? '' : elegido === x.valor ? ' elegida' : ' atenuada';
        return (
          <li key={x.valor}>
            <button type="button" className={'barra-fila' + estado} aria-pressed={elegido === x.valor} onClick={() => alElegir(elegido === x.valor ? TODAS : x.valor)} title={`${x.etiqueta}: ${x.n} ${x.n === 1 ? 'caso' : 'casos'} (${pct(x.n, total)}). Clic para filtrar.`}>
              <span className="b-nombre"><i style={{ background: x.color }} />{x.etiqueta}</span>
              <span className="b-pista"><span className="b-relleno" style={{ width: (x.n / max) * 100 + '%', background: x.color }} /></span>
              <span className="b-valor">{cantidad(x.n)}<small>{pct(x.n, total)}</small></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Columnas por mes, apiladas según el desglose. Al pasar el cursor se ve el detalle del mes;
// con clic se filtra todo el tablero a ese mes.
function GraficaMeses({ eje, series, elegido, alElegir }) {
  const [sobre, setSobre] = useState(null);
  const max = Math.max(1, ...eje.map((m) => m.casos.length));
  const paso = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5 / 5) * 5;
  const tope = Math.ceil(max / paso) * paso;
  const marcas = Array.from({ length: tope / paso + 1 }, (_, i) => i * paso);
  const mesSobre = sobre !== null ? eje[sobre] : null;

  // Ancho disponible por mes: con eso se decide cada cuántos meses poner nombre y si caben los números.
  // Todo cabe en el ancho de la tarjeta, sin barra de desplazamiento (salvo periodos muy largos).
  const area = useRef(null);
  const [ancho, setAncho] = useState(800);
  useLayoutEffect(() => {
    const observador = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    observador.observe(area.current);
    return () => observador.disconnect();
  }, []);
  const porMes = Math.max(ancho, eje.length * 12) / eje.length;
  const cadaCuantos = porMes >= 32 ? 1 : porMes >= 17 ? 2 : porMes >= 11 ? 3 : 6;
  const conValores = porMes >= 24;

  return (
    <div className="g-meses" onMouseLeave={() => setSobre(null)}>
      <div className="g-eje-y" aria-hidden="true">
        {marcas.map((v) => <span key={v} style={{ bottom: (v / tope) * 100 + '%' }}>{v}</span>)}
      </div>
      <div className="g-area" ref={area} style={{ overflowX: eje.length * 12 > ancho ? 'auto' : 'hidden' }}>
        <div className="g-columnas" style={{ minWidth: eje.length * 12, gap: porMes >= 24 ? 6 : 2 }}>
          {marcas.map((v) => <div key={v} className="g-linea" style={{ bottom: (v / tope) * 100 + '%' }} />)}
          {eje.map((m, i) => {
            const n = m.casos.length;
            const partes = series.map((s) => ({ ...s, n: m.casos.filter(s.es).length })).filter((p) => p.n);
            const estado = elegido ? (elegido === m.mes ? ' elegida' : ' atenuada') : '';
            return (
              <button
                key={m.mes} type="button" className={'g-col' + estado + (sobre === i ? ' sobre' : '') + (i > 0 && m.mes.endsWith('-01') ? ' nuevo-anio' : '')}
                onMouseEnter={() => setSobre(i)} onFocus={() => setSobre(i)} onBlur={() => setSobre(null)}
                onClick={() => alElegir(m.mes)} aria-label={`${mesLargo(m.mes)}: ${n} casos`} aria-pressed={elegido === m.mes}
              >
                <span className="g-pila" style={{ height: (n / tope) * 100 + '%' }}>
                  {conValores && n > 0 && <span className="g-total">{n}</span>}
                  {partes.map((p) => <span key={p.etiqueta} className="g-seg" style={{ flexGrow: p.n, background: p.color }} />)}
                </span>
                {/* Nombre del mes (cada cuantos quepan) y el año solo debajo de enero o del primer mes */}
                <span className="g-mes" aria-hidden="true">
                  <span>{i % cadaCuantos === 0 || elegido === m.mes ? MESES[+m.mes.slice(5, 7) - 1] : ' '}</span>
                  {(i === 0 || m.mes.endsWith('-01')) && <b>{m.mes.slice(0, 4)}</b>}
                </span>
              </button>
            );
          })}
          {mesSobre && (
            <div className={'g-tip' + (sobre > eje.length / 2 ? ' izq' : '')} style={{ left: ((sobre + 0.5) / eje.length) * 100 + '%' }} role="status">
              <strong>{mesLargo(mesSobre.mes)}</strong>
              <span className="g-tip-total">{mesSobre.casos.length} {mesSobre.casos.length === 1 ? 'caso' : 'casos'}</span>
              {series.length > 1 && series.map((s) => {
                const n = mesSobre.casos.filter(s.es).length;
                return n ? <span key={s.etiqueta} className="g-tip-fila"><i style={{ background: s.color }} />{s.etiqueta}<b>{n}</b></span> : null;
              })}
              <small className="suave">Clic para {elegido === mesSobre.mes ? 'quitar el filtro' : 'filtrar por este mes'}</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
