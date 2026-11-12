import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Las fotos de los empleados están publicadas por documento. Unas son .jpg y otras .png:
// se intenta con una y, si falla, con la otra. Si ninguna existe, se muestran las iniciales.
const BASE = 'https://admon.sao6.com.co/web/uploads/empleados/';
const FORMATOS = ['jpg', 'png'];

const iniciales = (nombre) =>
  String(nombre ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export default function FotoOperador({ cedula, nombre }) {
  // Espera a que se termine de escribir el documento antes de buscar la foto
  const [doc, setDoc] = useState(cedula);
  const [intento, setIntento] = useState(0);
  const [grande, setGrande] = useState(false);
  useEffect(() => {
    const espera = setTimeout(() => { setDoc(cedula); setIntento(0); }, 500);
    return () => clearTimeout(espera);
  }, [cedula]);

  const hayFoto = doc && doc.length >= 5 && intento < FORMATOS.length;
  if (!hayFoto) {
    return (
      <div className="foto sin-foto" title={doc ? 'No hay foto registrada para este documento' : 'Sin documento del operador'}>
        {iniciales(nombre) || (
          <svg viewBox="0 0 24 24" width="38" height="38" fill="currentColor" aria-hidden="true">
            <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z" />
          </svg>
        )}
      </div>
    );
  }

  const url = BASE + encodeURIComponent(doc) + '.' + FORMATOS[intento];
  const alt = 'Foto de ' + (nombre || 'el operador');
  return (
    <>
      <button type="button" className="foto" title="Ver foto más grande" onClick={() => setGrande(true)}>
        <img key={url} src={url} alt={alt} referrerPolicy="no-referrer" onError={() => setIntento(intento + 1)} />
      </button>
      {/* Se dibuja en el body: dentro de una tarjeta de vidrio el velo quedaría recortado a la tarjeta */}
      {grande && createPortal(
        <div className="velo" onClick={() => setGrande(false)}>
          <figure className="foto-grande">
            <img src={url} alt={alt} referrerPolicy="no-referrer" />
            <figcaption><strong>{nombre || 'Operador'}</strong><span>Documento {doc}</span></figcaption>
          </figure>
        </div>,
        document.body
      )}
    </>
  );
}
