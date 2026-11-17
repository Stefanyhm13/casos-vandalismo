import { useLayoutEffect, useRef, useState } from 'react';

// Selector de fecha con el diseño de la app (en lugar del del navegador) y campo de hora escrito a mano.
// Guardan la fecha como "AAAA-MM-DD" y la hora como "HH:MM".

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const dos = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

// Ventana flotante debajo (o encima) de su botón. Se dibuja en la capa superior del navegador,
// así no la recortan las tarjetas. Se cierra con Escape o al hacer clic fuera.
function Emergente({ abierto, cerrar, ancla, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!abierto) return;
    el.showPopover();
    const ubicar = () => {
      const a = ancla.current.getBoundingClientRect();
      const cabeAbajo = a.bottom + 6 + el.offsetHeight <= window.innerHeight || a.top - 6 - el.offsetHeight < 0;
      el.style.top = (cabeAbajo ? a.bottom + 6 : a.top - 6 - el.offsetHeight) + 'px';
      el.style.left = Math.max(8, Math.min(a.left, window.innerWidth - el.offsetWidth - 8)) + 'px';
    };
    ubicar();
    const fuera = (e) => { if (!el.contains(e.target) && !ancla.current.contains(e.target)) cerrar(); };
    const tecla = (e) => { if (e.key === 'Escape') { cerrar(); ancla.current.focus(); } };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    window.addEventListener('scroll', ubicar, true);
    window.addEventListener('resize', ubicar);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('scroll', ubicar, true);
      window.removeEventListener('resize', ubicar);
      if (el.matches(':popover-open')) el.hidePopover();
    };
  }, [abierto]);
  return <div ref={ref} popover="manual" className="emergente">{abierto && children}</div>;
}

const Icono = ({ children }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export function CampoFecha({ id, value, onChange }) {
  const boton = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState([2026, 0]); // año y mes (0-11) que muestra el calendario
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const hoy = iso(new Date());

  const alternar = () => {
    if (!abierto) { const base = valida ? value : hoy; setVista([+base.slice(0, 4), +base.slice(5, 7) - 1]); }
    setAbierto(!abierto);
  };
  const elegir = (v) => { onChange(v); setAbierto(false); boton.current.focus(); };
  const mover = (meses) => setVista(([a, m]) => { const d = new Date(a, m + meses, 1); return [d.getFullYear(), d.getMonth()]; });

  const [anio, mes] = vista;
  const corrimiento = (new Date(anio, mes, 1).getDay() + 6) % 7; // la semana empieza en lunes
  const celdas = Array.from({ length: 42 }, (_, i) => new Date(anio, mes, 1 - corrimiento + i));

  return (
    <>
      <button type="button" id={id} ref={boton} className={'selector' + (value ? '' : ' sin-valor')} aria-haspopup="dialog" aria-expanded={abierto} onClick={alternar}>
        <span>{valida ? value.split('-').reverse().join('/') : value || 'dd/mm/aaaa'}</span>
        <Icono><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icono>
      </button>
      <Emergente abierto={abierto} cerrar={() => setAbierto(false)} ancla={boton}>
        <div className="calendario" role="dialog" aria-label="Elegir fecha">
          <header>
            <button type="button" title="Año anterior" onClick={() => mover(-12)}>«</button>
            <button type="button" title="Mes anterior" onClick={() => mover(-1)}>‹</button>
            <strong>{MESES[mes]} {anio}</strong>
            <button type="button" title="Mes siguiente" onClick={() => mover(1)}>›</button>
            <button type="button" title="Año siguiente" onClick={() => mover(12)}>»</button>
          </header>
          <div className="rejilla semana">{DIAS.map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="rejilla">
            {celdas.map((d) => {
              const v = iso(d);
              const clase = (d.getMonth() === mes ? '' : 'otro-mes ') + (v === value ? 'elegido ' : '') + (v === hoy ? 'hoy' : '');
              return <button type="button" key={v} className={clase} onClick={() => elegir(v)}>{d.getDate()}</button>;
            })}
          </div>
          <footer>
            <button type="button" onClick={() => elegir(hoy)}>Hoy</button>
            <button type="button" onClick={() => elegir('')}>Borrar</button>
          </footer>
        </div>
      </Emergente>
    </>
  );
}

// "7" -> "07:00", "730" -> "07:30", "1430" -> "14:30". Devuelve null si no es una hora válida.
export const completarHora = (texto) => {
  const d = String(texto ?? '').replace(/\D/g, '').slice(0, 4);
  if (!d) return '';
  const [h, m] = d.length <= 2 ? [d, '00'] : d.length === 3 ? [d.slice(0, 1), d.slice(1)] : [d.slice(0, 2), d.slice(2)];
  return +h <= 23 && +m <= 59 ? dos(+h) + ':' + m : null;
};

// Hora escrita a mano en formato 24 horas. Los dos puntos se ponen solos mientras se escribe
// y al salir del campo (o con Enter) se completa. Si no es una hora válida, se avisa.
export function CampoHora({ id, value, onChange }) {
  const [malo, setMalo] = useState(false);
  const escribir = (e) => {
    let d = e.target.value.replace(/\D/g, '');
    if (d[0] > '2') d = '0' + d; // "7" es la hora 07: así "730" queda "07:30"
    d = d.slice(0, 4);
    setMalo(false);
    onChange(d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2) : d);
  };
  const completar = () => {
    const h = completarHora(value);
    if (h === null) return setMalo(true);
    if (h !== value) onChange(h);
  };
  return (
    <>
      <input
        id={id} value={value} onChange={escribir} onBlur={completar}
        onKeyDown={(e) => e.key === 'Enter' && completar()}
        inputMode="numeric" maxLength={5} placeholder="hh:mm (24 horas)" autoComplete="off" aria-invalid={malo || undefined}
      />
      {malo && <small className="nota">Hora no válida. Escríbala en formato 24 horas, por ejemplo 07:30 o 18:45.</small>}
    </>
  );
}
