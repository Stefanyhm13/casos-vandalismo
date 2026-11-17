// Arma el libro de Excel con los casos elegidos: una fila por caso y una columna por campo,
// agrupadas por sección, con encabezados fijos, filtros y fechas como fechas de verdad.
import ExcelJS from 'exceljs';
import { idCaso } from '../shared/campos.js';

const VERDE_PROF = 'FF0D4F28', VERDE_OSC = 'FF1B7A3E', VERDE = 'FF25A055', FRANJA = 'FFF1F8F3', LINEA = 'FFD5E3D9', BLANCO = 'FFFFFFFF';
const relleno = (color) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });
const borde = { style: 'thin', color: { argb: LINEA } };
const ANCHOS = { area: 60, fecha: 14, hora: 9, codigo: 11, numero: 17, mayus: 13, opcion: 18 };

// "2026-09-22" o "2026-09-22 06:00:00" -> fecha de Excel. Cualquier otra cosa (vacío, N/A) queda como texto.
function comoFecha(v) {
  const p = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(v ?? '');
  return p ? new Date(Date.UTC(+p[1], +p[2] - 1, +p[3], +(p[4] ?? 0), +(p[5] ?? 0))) : v ?? '';
}

export async function libroDeCasos(casos, cfg, usuario) {
  const columnas = [
    { seccion: 'Caso', titulo: 'ID', ancho: 11, valor: (c) => idCaso(c.id), centro: true },
    { seccion: 'Caso', titulo: 'Fecha de creación', ancho: 18, valor: (c) => comoFecha(c.creado_en), formato: 'dd/mm/yyyy hh:mm', centro: true },
    { seccion: 'Caso', titulo: 'Registrado por', ancho: 22, valor: (c) => c.creado_por ?? '' },
    ...cfg.secciones.flatMap((s) => s.campos.map((campo) => ({
      seccion: s.titulo,
      titulo: campo.etiqueta,
      ancho: ANCHOS[campo.tipo] ?? Math.max(20, Math.min(34, campo.etiqueta.length + 6)),
      valor: (c) => (campo.tipo === 'fecha' ? comoFecha(c[campo.id]) : c[campo.id] ?? ''),
      formato: campo.tipo === 'fecha' ? 'dd/mm/yyyy' : undefined,
      centro: ['fecha', 'hora', 'codigo', 'opcion'].includes(campo.tipo),
    }))),
  ];
  const n = columnas.length;

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Casos Vandalismo';
  libro.created = new Date();
  const hoja = libro.addWorksheet('Casos', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  hoja.columns = columnas.map((c) => ({ width: c.ancho }));

  // Fila 1: título. Fila 2: cuándo y quién lo exportó.
  hoja.mergeCells(1, 1, 1, n);
  Object.assign(hoja.getCell(1, 1), {
    value: 'Casos de vandalismo · Sistema Alimentador Oriental',
    font: { name: 'Calibri', size: 16, bold: true, color: { argb: BLANCO } },
    fill: relleno(VERDE_PROF),
    alignment: { vertical: 'middle', indent: 1 },
  });
  hoja.getRow(1).height = 32;
  const ahora = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' });
  hoja.mergeCells(2, 1, 2, n);
  Object.assign(hoja.getCell(2, 1), {
    value: `${casos.length} ${casos.length === 1 ? 'caso' : 'casos'} · Exportado el ${ahora} por ${usuario.nombre}`,
    font: { name: 'Calibri', size: 10.5, italic: true, color: { argb: 'FF55655B' } },
    alignment: { vertical: 'middle', indent: 1 },
  });
  hoja.getRow(2).height = 20;

  // Fila 3: una banda por sección. Fila 4: el nombre de cada campo.
  let inicio = 0;
  let tono = 0;
  columnas.forEach((c, i) => {
    if (i + 1 < n && columnas[i + 1].seccion === c.seccion) return;
    if (i > inicio) hoja.mergeCells(3, inicio + 1, 3, i + 1);
    Object.assign(hoja.getCell(3, inicio + 1), {
      value: c.seccion,
      font: { name: 'Calibri', size: 11, bold: true, color: { argb: BLANCO } },
      fill: relleno(tono++ % 2 ? VERDE_OSC : VERDE_PROF),
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { left: { style: 'thin', color: { argb: BLANCO } }, right: { style: 'thin', color: { argb: BLANCO } } },
    });
    inicio = i + 1;
  });
  hoja.getRow(3).height = 22;
  columnas.forEach((c, i) => Object.assign(hoja.getCell(4, i + 1), {
    value: c.titulo,
    font: { name: 'Calibri', size: 10.5, bold: true, color: { argb: BLANCO } },
    fill: relleno(VERDE),
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: { left: { style: 'thin', color: { argb: BLANCO } }, right: { style: 'thin', color: { argb: BLANCO } } },
  }));
  hoja.getRow(4).height = 34;
  hoja.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: n } };

  casos.forEach((caso, f) => {
    const fila = hoja.getRow(5 + f);
    columnas.forEach((c, i) => Object.assign(fila.getCell(i + 1), {
      value: c.valor(caso),
      numFmt: c.formato,
      font: { name: 'Calibri', size: 10.5, bold: i === 0, color: { argb: i === 0 ? VERDE_OSC : 'FF17231C' } },
      fill: relleno(f % 2 ? FRANJA : BLANCO),
      alignment: { vertical: 'top', horizontal: c.centro ? 'center' : 'left', wrapText: true },
      border: { top: borde, bottom: borde, left: borde, right: borde },
    }));
  });

  return Buffer.from(await libro.xlsx.writeBuffer());
}
