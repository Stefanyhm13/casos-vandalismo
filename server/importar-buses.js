// Carga el listado de buses (número y placa) desde el Excel "Placas Unidad SAO6".
// Uso:  npm run importar-buses -- "ruta/al/archivo.xlsx"
// El Excel trae varias parejas de columnas BUS / PLACA, con el bus escrito como "C6-001".
// En la aplicación el número del bus se guarda solo con dígitos y sin ceros a la izquierda: "1".
import ExcelJS from 'exceljs';
import { db } from './db.js';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Indique la ruta del Excel:  npm run importar-buses -- "Placas Unidad SAO6.xlsx"');
  process.exit(1);
}

const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(ruta);
const buses = new Map();
const omitidas = [];
libro.worksheets[0].eachRow((fila, n) => {
  if (n < 2) return; // encabezados
  for (let col = 1; col <= fila.cellCount; col += 2) {
    const bus = String(fila.getCell(col).text ?? '').trim();
    const placa = String(fila.getCell(col + 1).text ?? '').replace(/[\s-]/g, '').toUpperCase();
    if (!bus && !placa) continue;
    const numero = /(\d+)\s*$/.exec(bus)?.[1];
    if (!numero || !placa) { omitidas.push(`${bus || '(sin bus)'} / ${placa || '(sin placa)'}`); continue; }
    buses.set(String(Number(numero)), placa);
  }
});

const antes = new Map((await db.todos('SELECT numero, placa FROM buses')).map((b) => [b.numero, b.placa]));
await db.transaccion((t) => t.varios('REPLACE INTO buses (numero, placa) VALUES ?', [...buses]));

const nuevos = [...buses].filter(([n]) => !antes.has(n));
const cambiados = [...buses].filter(([n, p]) => antes.has(n) && antes.get(n) !== p);
console.log(`Buses en el Excel: ${buses.size} · nuevos: ${nuevos.length} · con placa corregida: ${cambiados.length}`);
for (const [n, p] of cambiados) console.log(`  Bus ${n}: ${antes.get(n)} -> ${p}`);
if (omitidas.length) console.log('Filas que no se pudieron leer:', omitidas.join(', '));
await db.cerrar();
