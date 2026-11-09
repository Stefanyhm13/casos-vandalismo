// Carga los datos del Excel "Datos Atención Vandalismo" en la base de datos.
// Uso:  npm run importar -- "ruta/al/archivo.xlsx"
// Operadores y buses se actualizan siempre. Los casos solo se cargan si la base aún no tiene casos.
import ExcelJS from 'exceljs';
import { db } from './db.js';
import { CAMPOS, normalizar } from '../shared/campos.js';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Indica la ruta del Excel:  npm run importar -- "Datos Atención Vandalismo.xlsx"');
  process.exit(1);
}

// Lectura en modo "streaming": el archivo trae validaciones sobre un millón de filas
// y la lectura normal se queda colgada con ellas.
const hojas = {};
const lector = new ExcelJS.stream.xlsx.WorkbookReader(ruta, { sharedStrings: 'cache', worksheets: 'emit', styles: 'cache', hyperlinks: 'ignore' });
for await (const hoja of lector) {
  const filas = (hojas[hoja.name] = []);
  for await (const fila of hoja) filas[fila.number] = fila.values;
}
const cadaFila = (filas, fn) => filas.forEach((f, n) => f && fn({ getCell: (i) => f[i] }, n));

// Valor simple de una celda (resuelve fórmulas y texto con formato)
function valor(v) {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) v = v.result;
    else if ('richText' in v) v = v.richText.map((t) => t.text).join('');
    else if ('text' in v) v = v.text;
    else if ('formula' in v || 'sharedFormula' in v) v = null;
  }
  if (v && typeof v === 'object' && !(v instanceof Date)) v = null; // errores de fórmula
  return v ?? '';
}
const texto = (v) => String(v).replace(/\s+/g, ' ').trim();
const dos = (n) => String(n).padStart(2, '0');
const fecha = (v) => (v instanceof Date ? `${v.getUTCFullYear()}-${dos(v.getUTCMonth() + 1)}-${dos(v.getUTCDate())}` : '');
const hora = (v) => (v instanceof Date ? `${dos(v.getUTCHours())}:${dos(v.getUTCMinutes())}` : '');
// "No Registra", "N/A" y "-" significan lo mismo que vacío
const sinDato = (v) => (/^(no registra|n\/?a|-)$/i.test(texto(v)) ? '' : texto(v));
const nombrePropio = (s) => texto(s).toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

db.exec('BEGIN');
try {
  // --- Operadores (hoja rptDriver): solo código, nombre y documento ---
  const hOper = hojas.rptDriver;
  let nOper = 0;
  if (hOper) {
    const ins = db.prepare('INSERT OR REPLACE INTO operadores (codigo, nombre, cedula) VALUES (?, ?, ?)');
    cadaFila(hOper, (fila, n) => {
      if (n < 5) return;
      const codigo = texto(valor(fila.getCell(1))).replace(/\D/g, '');
      if (!codigo) return;
      ins.run(codigo.padStart(4, '0'), nombrePropio(`${valor(fila.getCell(2))} ${valor(fila.getCell(3))}`), texto(valor(fila.getCell(5))).replace(/\D/g, ''));
      nOper++;
    });
  }

  // --- Buses (hoja Placas) ---
  const hBus = hojas.Placas;
  let nBus = 0;
  if (hBus) {
    const ins = db.prepare('INSERT OR REPLACE INTO buses (numero, placa) VALUES (?, ?)');
    cadaFila(hBus, (fila, n) => {
      const numero = texto(valor(fila.getCell(1)));
      if (n < 2 || !/^\d+$/.test(numero)) return;
      ins.run(numero, texto(valor(fila.getCell(2))).toUpperCase());
      nBus++;
    });
  }
  console.log(`Operadores cargados: ${nOper} · Buses cargados: ${nBus}`);

  // --- Casos (hoja Datos) ---
  const yaHay = db.prepare('SELECT COUNT(*) n FROM casos').get().n;
  if (yaHay > 0) {
    console.log(`La base ya tiene ${yaHay} casos: no se vuelven a importar para no duplicarlos.`);
  } else {
    const hoja = hojas.Datos;
    if (!hoja) throw new Error('El archivo no tiene la hoja "Datos"');
    // Columna del Excel -> campo. Se leen por posición, igual que en la plantilla.
    const columnas = [
      'fecha_novedad', 'hora', 'lugar', 'codigo_operador', 'nombre_operador', 'cedula_operador', 'numero_bus', 'placa_bus',
      'narracion', 'descripcion_danos', 'nombre_tercero', 'identificacion_tercero', 'placa_tercero', 'contacto_tercero',
      'interno_policia', 'placa_moto_policia', 'denuncia_penal', 'radicado_fiscalia', 'tipo_dano',
      'boton_panico', 'intervencion_cmo', 'intervencion_promotor', 'intervencion_sies24', 'organismos_apoyo',
      'fuente_evento', 'categoria_riesgo', 'responsabilidad', 'restriccion_operador', 'tiempo_restriccion', 'estado',
      'clasificacion_cuantia', 'proceso_legal',
    ];
    const operador = db.prepare('SELECT * FROM operadores WHERE codigo = ?');
    const bus = db.prepare('SELECT * FROM buses WHERE numero = ?');
    const ins = db.prepare(`INSERT INTO casos (creado_por, ${columnas.join(', ')}) VALUES (?${', ?'.repeat(columnas.length)})`);
    const hist = db.prepare("INSERT INTO historial (caso_id, usuario, rol, detalle) VALUES (?, 'Importación', 'Sistema', 'Caso cargado desde el Excel')");
    let nCasos = 0;
    cadaFila(hoja, (fila, n) => {
      if (n < 3) return;
      const c = {};
      columnas.forEach((id, i) => {
        const v = valor(fila.getCell(i + 1));
        c[id] = id === 'fecha_novedad' ? fecha(v) : id === 'hora' ? hora(v) : normalizar(CAMPOS[id], sinDato(v));
      });
      if (!c.fecha_novedad && !c.codigo_operador && !c.narracion) return; // fila vacía de la tabla
      // Nombre, documento y placa venían de fórmulas: si no hay valor, se buscan en los listados
      const op = operador.get(c.codigo_operador);
      c.nombre_operador ||= op?.nombre ?? '';
      c.cedula_operador ||= op?.cedula ?? '';
      c.placa_bus ||= bus.get(c.numero_bus)?.placa ?? '';
      const r = ins.run('Importación', ...columnas.map((id) => c[id]));
      hist.run(r.lastInsertRowid);
      nCasos++;
    });
    console.log(`Casos importados: ${nCasos}`);
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
