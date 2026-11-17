// Consulta de operadores en la base Reportes de la empresa (SQL Server, solo lectura).
// Es opcional: si no están los datos MSSQL_* en el archivo .env, o el servidor no responde,
// la app sigue funcionando con el listado importado.
// De la vista solo se leen el documento, el nombre y el código del operador.
import sql from 'mssql';

let pool;
async function conectar() {
  pool ??= new sql.ConnectionPool({
    server: process.env.MSSQL_SERVER,
    port: Number(process.env.MSSQL_PORT) || 1433,
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    // Siempre la base Reportes (se puede cambiar el nombre con REPORTES_DATABASE)
    database: process.env.REPORTES_DATABASE || 'Reportes',
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 5000,
    requestTimeout: 8000,
  }).connect();
  return pool;
}

// Reportes trae el nombre como "APELLIDOS NOMBRES"; la app lo guarda como "Nombres Apellidos",
// igual que en los casos anteriores:
//   "PEREZ GOMEZ JUAN CARLOS" -> "Juan Carlos Perez Gomez"
//   "DE LA CRUZ LOPEZ MARIA"  -> "Maria de la Cruz Lopez"
//   "PEREZ JUAN"              -> "Juan Perez"
// Se toman como apellidos las dos primeras palabras (con sus partículas: de, del, la…) y lo demás
// como nombres. Ojo: con una sola palabra de apellido y dos nombres ("PEREZ JUAN CARLOS") no hay
// forma de saberlo y queda "Carlos Perez Juan"; se corrige a mano en el caso.
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa', 'y', 'da', 'di', 'van', 'von']);
export function nombreEnOrden(s) {
  const p = String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase().split(' ').filter(Boolean);
  let corte = 0;
  for (let apellidos = 0; apellidos < 2; apellidos++) {
    let j = corte;
    while (j < p.length && PARTICULAS.has(p[j])) j++;
    if (j + 1 >= p.length) break; // debe quedar al menos un nombre
    corte = j + 1;
  }
  const mayuscula = (w, i) => (i > 0 && PARTICULAS.has(w) && !w.startsWith('san') ? w : w.replace(/^\S/, (l) => l.toUpperCase()));
  return [...p.slice(corte), ...p.slice(0, corte)].map(mayuscula).join(' ');
}

// Busca por 'codigo' o por 'cedula'. Devuelve una lista de { codigo, cedula, nombre } (vacía si no
// hay nadie o el servidor no responde). Quien no es operador viene con codigo ''.
// Un código viejo puede aparecer en dos personas, por eso se devuelve la lista completa.
export async function operadoresEnReportes(columna, valor) {
  if (!process.env.MSSQL_SERVER || !valor || valor.length > 15) return [];
  try {
    const consulta = (await conectar()).request();
    if (columna === 'codigo') consulta.input('valor', sql.Int, Number(valor));
    else consulta.input('valor', sql.VarChar(15), valor);
    const r = await consulta.query(
      `SELECT Empleado AS cedula, Nombre AS nombre, CodigoOperador AS codigo
       FROM Sao_vw_ti_ParametrosPrepensionado
       WHERE ${columna === 'codigo' ? 'CodigoOperador' : 'Empleado'} = @valor ORDER BY CodigoOperador DESC`
    );
    return r.recordset.map((o) => ({
      codigo: o.codigo > 0 ? String(o.codigo).padStart(4, '0') : '',
      cedula: String(o.cedula).trim(),
      nombre: nombreEnOrden(o.nombre),
    }));
  } catch (e) {
    console.error('La base Reportes no respondió:', e.message);
    pool = undefined; // se vuelve a intentar la conexión en la próxima consulta
    return [];
  }
}
