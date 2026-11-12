// Envío de correos por el servidor SMTP de la empresa. Es opcional: si no están los datos SMTP_*
// en el archivo .env, la app funciona igual y simplemente no envía avisos.
import nodemailer from 'nodemailer';
import { idCaso, sinDato } from '../shared/campos.js';

export const correoActivo = () => !!process.env.SMTP_HOST;
export const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

let transporte;
async function enviar({ para, asunto, texto, html }) {
  const puerto = Number(process.env.SMTP_PORT) || 587;
  transporte ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transporte.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: para, subject: asunto, text: texto, html });
}

const limpio = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Arma el mensaje con el mismo contenido en texto plano y en HTML.
function mensaje({ saludo, parrafos, datos = [], enlace }) {
  const texto = [saludo, '', ...parrafos.flatMap((p) => [p, '']), ...datos.map(([k, v]) => `${k}: ${v}`), datos.length ? '' : null,
    enlace ? `Ingrese al aplicativo: ${enlace}` : null, enlace ? '' : null,
    'Este es un mensaje automático del aplicativo Casos Vandalismo. Por favor, no responda a este correo.',
  ].filter((l) => l !== null).join('\n');
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#17231c;max-width:560px;margin:0 auto">
  <div style="background:#1b7a3e;color:#fff;padding:16px 22px;border-radius:14px 14px 0 0">
    <strong style="font-size:18px">Casos Vandalismo</strong><br><span style="font-size:13px;color:#cfeeda">Sistema Alimentador Oriental</span>
  </div>
  <div style="border:1px solid #d5e3d9;border-top:0;padding:22px;border-radius:0 0 14px 14px">
    <p style="margin:0 0 14px">${limpio(saludo)}</p>
    ${parrafos.map((p) => `<p style="margin:0 0 14px">${limpio(p)}</p>`).join('')}
    ${datos.length ? `<table style="border-collapse:collapse;margin:0 0 16px">${datos.map(([k, v]) =>
      `<tr><td style="padding:4px 14px 4px 0;color:#55655b">${limpio(k)}</td><td style="padding:4px 0"><strong>${limpio(v)}</strong></td></tr>`).join('')}</table>` : ''}
    ${enlace ? `<p style="margin:0 0 18px"><a href="${limpio(enlace)}" style="display:inline-block;background:#25a055;color:#fff;text-decoration:none;font-weight:600;padding:10px 20px;border-radius:10px">Abrir el caso</a></p>` : ''}
    <p style="margin:0;font-size:12.5px;color:#55655b">Este es un mensaje automático del aplicativo Casos Vandalismo. Por favor, no responda a este correo.</p>
  </div>
</div>`;
  return { texto, html };
}

const fechaLegible = (f) => (/^\d{4}-\d{2}-\d{2}$/.test(f) ? f.split('-').reverse().join('/') : f);

// Avisa a cada destinatario ({ nombre, correo, area }) que hay un caso nuevo por diligenciar.
// Nunca interrumpe la creación del caso: si un envío falla, queda en el registro del servidor.
export async function avisarCasoNuevo(caso, creador, destinatarios) {
  if (!correoActivo()) return;
  const id = idCaso(caso.id);
  const base = (process.env.APP_URL || '').replace(/\/+$/, '');
  const datos = [
    ['Caso', id],
    ['Fecha de la novedad', sinDato(caso.fecha_novedad) ? 'Sin registrar' : fechaLegible(caso.fecha_novedad) + (sinDato(caso.hora) ? '' : ' ' + caso.hora)],
    ['Lugar', sinDato(caso.lugar) ? 'Sin registrar' : caso.lugar],
    ['Tipo de daño', sinDato(caso.tipo_dano) ? 'Sin registrar' : caso.tipo_dano],
    ['Registrado por', creador.nombre],
  ];
  for (const d of destinatarios) {
    const cuerpo = mensaje({
      saludo: `Cordial saludo, ${d.nombre}:`,
      parrafos: [
        `Le informamos que se registró el caso de vandalismo ${id} en el aplicativo Casos Vandalismo.`,
        `Le solicitamos ingresar al aplicativo y diligenciar la información que corresponde a ${d.area}.`,
      ],
      datos,
      enlace: base ? `${base}/#/caso/${caso.id}` : '',
    });
    await enviar({ para: d.correo, asunto: `Nuevo caso de vandalismo ${id}: información pendiente por diligenciar`, ...cuerpo })
      .catch((e) => { console.error(`No se pudo enviar el correo del caso ${id} a ${d.correo}:`, e.message); transporte = undefined; });
  }
}

// Correo de prueba para comprobar la configuración SMTP. Aquí el error sí se devuelve.
export async function enviarPrueba(usuario) {
  const cuerpo = mensaje({
    saludo: `Cordial saludo, ${usuario.nombre}:`,
    parrafos: ['Este es un correo de prueba. El envío de avisos del aplicativo Casos Vandalismo está funcionando correctamente.'],
  });
  await enviar({ para: usuario.correo, asunto: 'Casos Vandalismo: correo de prueba', ...cuerpo }).catch((e) => { transporte = undefined; throw e; });
}
