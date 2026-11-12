import { useState } from 'react';

// Campo de contraseña con el botón del ojo para verla u ocultarla.
export default function CampoClave(props) {
  const [visible, setVisible] = useState(false);
  const texto = visible ? 'Ocultar contraseña' : 'Ver contraseña';
  return (
    <span className="campo-clave">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button type="button" aria-label={texto} title={texto} aria-pressed={visible} onClick={() => setVisible(!visible)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  );
}
