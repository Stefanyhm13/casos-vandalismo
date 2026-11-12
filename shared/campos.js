// Definición única de roles, secciones y campos.
// La usan tanto el servidor (permisos y base de datos) como la app web (formularios).

export const ROLES = {
  ADMIN: 'Administrador',
  'PESV-ADMIN': 'PESV Administrativo',
  'PROF-CMO': 'Profesional CMO',
  SIES24: 'SIES24',
  'PROF-JURIDICO': 'Profesional Jurídico',
  CONSULTA: 'Solo consulta',
};

const SI_NO = ['Si', 'No'];

// Cada sección pertenece a un rol: solo ese rol (y el Administrador) puede modificarla.
export const SECCIONES = [
  {
    id: 'novedad',
    titulo: 'Datos de la novedad',
    rol: 'PESV-ADMIN',
    campos: [
      { id: 'fecha_novedad', etiqueta: 'Fecha de la novedad', tipo: 'fecha' },
      { id: 'hora', etiqueta: 'Hora', tipo: 'hora' },
      { id: 'lugar', etiqueta: 'Lugar', tipo: 'texto', ancho: 2 },
      { id: 'codigo_operador', etiqueta: 'Código del operador', tipo: 'codigo', ayuda: '4 dígitos. Se completa con ceros.' },
      { id: 'nombre_operador', etiqueta: 'Nombre del operador', tipo: 'texto', ancho: 2 },
      { id: 'cedula_operador', etiqueta: 'Documento del operador', tipo: 'numero', ayuda: 'Solo números' },
      { id: 'numero_bus', etiqueta: 'Número del bus', tipo: 'numero' },
      { id: 'placa_bus', etiqueta: 'Placa del bus', tipo: 'mayus' },
      { id: 'tipo_dano', etiqueta: 'Tipo de daño', tipo: 'opcion', opciones: ['Leve', 'Grave', 'Gravísimo'] },
      { id: 'narracion', etiqueta: 'Narración de los hechos', tipo: 'area', ancho: 4 },
      { id: 'descripcion_danos', etiqueta: 'Descripción de los daños', tipo: 'area', ancho: 4 },
    ],
  },
  {
    id: 'tercero',
    titulo: 'Datos del tercero',
    rol: 'PESV-ADMIN',
    campos: [
      { id: 'nombre_tercero', etiqueta: 'Nombre del tercero', tipo: 'texto', ancho: 2 },
      { id: 'identificacion_tercero', etiqueta: 'Identificación del tercero', tipo: 'numero', ayuda: 'Solo números' },
      { id: 'placa_tercero', etiqueta: 'Placa del tercero', tipo: 'mayus' },
      { id: 'contacto_tercero', etiqueta: 'Número de contacto del tercero', tipo: 'texto', ancho: 2 },
    ],
  },
  {
    id: 'autoridades',
    titulo: 'Policía y denuncia',
    rol: 'PESV-ADMIN',
    campos: [
      { id: 'interno_policia', etiqueta: 'Número interno de policía', tipo: 'texto' },
      { id: 'placa_moto_policia', etiqueta: 'Placa moto de policía', tipo: 'texto' },
      {
        id: 'organismos_apoyo', etiqueta: 'Asisten organismos de apoyo', tipo: 'opcion', ancho: 2,
        opciones: ['No', 'Policía', 'Movilidad', 'Salud', 'Policía - Movilidad', 'Policía - Salud', 'Salud - Movilidad', 'Policía - Movilidad - Salud'],
      },
      { id: 'denuncia_penal', etiqueta: 'Denuncia penal', tipo: 'opcion', opciones: SI_NO },
      { id: 'radicado_fiscalia', etiqueta: 'Número de radicado Fiscalía', tipo: 'texto', ancho: 2 },
    ],
  },
  {
    id: 'cmo',
    titulo: 'Atención del CMO',
    rol: 'PROF-CMO',
    campos: [
      { id: 'boton_panico', etiqueta: 'Activación del botón de pánico', tipo: 'opcion', opciones: SI_NO },
      { id: 'intervencion_cmo', etiqueta: 'Intervención del CMO', tipo: 'opcion', opciones: SI_NO },
      { id: 'intervencion_promotor', etiqueta: 'Intervención del promotor', tipo: 'opcion', opciones: SI_NO },
      { id: 'intervencion_sies24', etiqueta: 'Intervención de SIES24', tipo: 'opcion', opciones: SI_NO },
    ],
  },
  {
    id: 'sies24',
    titulo: 'Análisis SIES24',
    rol: 'SIES24',
    campos: [
      { id: 'fuente_evento', etiqueta: 'Fuente del evento', tipo: 'opcion', opciones: ['Directo', 'Se deriva de una novedad'] },
      { id: 'categoria_riesgo', etiqueta: 'Categoría del riesgo', tipo: 'texto' },
      { id: 'responsabilidad', etiqueta: 'Responsabilidad', tipo: 'opcion', opciones: ['Interno', 'Externo'] },
      { id: 'estado', etiqueta: 'Estado', tipo: 'opcion', opciones: ['Abierto', 'Pendiente', 'Cerrado'] },
      { id: 'restriccion_operador', etiqueta: 'Restricción del operador', tipo: 'opcion', opciones: SI_NO },
      { id: 'tiempo_restriccion', etiqueta: 'Tiempo de restricción', tipo: 'texto' },
    ],
  },
  {
    id: 'juridico',
    titulo: 'Gestión jurídica',
    rol: 'PROF-JURIDICO',
    campos: [
      { id: 'clasificacion_cuantia', etiqueta: 'Clasificación de la cuantía', tipo: 'texto', ancho: 2 },
      { id: 'proceso_legal', etiqueta: 'Proceso legal', tipo: 'area', ancho: 4 },
    ],
  },
];

// Índice campo -> definición (con el rol dueño)
export const CAMPOS = Object.fromEntries(
  SECCIONES.flatMap((s) => s.campos.map((c) => [c.id, { ...c, rol: s.rol, seccion: s.id }]))
);

// Tipos que el administrador puede elegir al crear un campo nuevo para un rol.
export const TIPOS_NUEVOS = {
  texto: 'Texto corto',
  area: 'Texto largo',
  numero: 'Número',
  fecha: 'Fecha',
  hora: 'Hora',
  opcion: 'Lista de opciones',
};

// Une lo fijo de este archivo con los roles y campos creados por el administrador.
//   rolesExtra:  [{ id, nombre, campos: [ids que puede editar], puede_crear }]
//   camposExtra: [{ id, rol, etiqueta, tipo, opciones }]  (campos propios de un rol creado)
// La usan el servidor y la app web, así los permisos se calculan igual en ambos lados.
export function armar(rolesExtra = [], camposExtra = []) {
  const roles = { ...ROLES };
  const extra = {};
  for (const r of rolesExtra) { roles[r.id] = r.nombre; extra[r.id] = r; }

  const secciones = [...SECCIONES];
  for (const r of rolesExtra) {
    const propios = camposExtra.filter((c) => c.rol === r.id);
    if (!propios.length) continue;
    secciones.push({
      id: 'sec-' + r.id,
      titulo: r.nombre,
      rol: r.id,
      campos: propios.map((c) => ({ id: c.id, etiqueta: c.etiqueta, tipo: c.tipo, opciones: c.opciones, ancho: c.tipo === 'area' ? 4 : 1 })),
    });
  }
  const campos = Object.fromEntries(
    secciones.flatMap((s) => s.campos.map((c) => [c.id, { ...c, rol: s.rol, seccion: s.id }]))
  );

  // Un rol edita los campos de sus propias secciones y, si es un rol creado, los que le marcaron.
  const puedeEditar = (rol, campoId) =>
    !!campos[campoId] && (rol === 'ADMIN' || campos[campoId].rol === rol || !!extra[rol]?.campos.includes(campoId));
  const puedeCrear = (rol) => rol === 'ADMIN' || rol === 'PESV-ADMIN' || !!extra[rol]?.puede_crear;

  return { roles, rolesExtra, secciones, campos, puedeEditar, puedeCrear };
}

export const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');
export const codigo4 = (v) => {
  const d = soloDigitos(v).slice(0, 4);
  return d ? d.padStart(4, '0') : '';
};
export const idCaso = (id) => 'CV-' + String(id).padStart(4, '0');

// Limpia un valor según el tipo de campo. Ningún campo es obligatorio: vacío siempre es válido.
export function normalizar(campo, valor) {
  const v = valor == null ? '' : String(valor).trim();
  if (!v) return '';
  switch (campo.tipo) {
    case 'codigo': return codigo4(v);
    case 'numero': return soloDigitos(v);
    case 'mayus': return v.toUpperCase();
    case 'fecha': return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
    case 'hora': return /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : '';
    case 'opcion': return campo.opciones.includes(v) ? v : '';
    default: return v;
  }
}
