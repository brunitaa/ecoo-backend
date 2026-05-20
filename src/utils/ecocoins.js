/** Fallback si no hay regla en BD (solo desarrollo) */
const REGLAS_TIPO_FALLBACK = {
  reciclaje_botellas: { puntos_por_unidad: 6, unidad: 'botella', co2_por_unidad: 0.05, peso_kg_por_unidad: 0.03 },
  reciclaje_papel: { puntos_por_unidad: 10, unidad: 'kg', co2_por_unidad: 0.4, peso_kg_por_unidad: 1 },
  eco_transporte: { puntos_por_unidad: 20, unidad: 'viaje', co2_por_unidad: 2.1, peso_kg_por_unidad: 0 },
};

export function fallbackRegla(tipoCodigo) {
  const f = REGLAS_TIPO_FALLBACK[tipoCodigo];
  return (
    f ?? {
      puntos_por_unidad: 5,
      unidad: 'unidad',
      co2_por_unidad: 0.2,
      peso_kg_por_unidad: 0.1,
      tipo: { codigo: tipoCodigo, nombre: tipoCodigo, unidad_medida: 'unidad' },
    }
  );
}

/** Normaliza regla de BD o fallback a formato de cálculo */
export function normalizarRegla(reglaDb, tipoCodigo, unidadPunto) {
  if (reglaDb?.puntos_por_unidad != null) {
    return {
      puntos_por_unidad: reglaDb.puntos_por_unidad,
      co2_por_unidad: Number(reglaDb.co2_por_unidad ?? 0.1),
      peso_kg_por_unidad: Number(reglaDb.peso_kg_por_unidad ?? 0.1),
      unidad: reglaDb.tipo?.unidad_medida ?? unidadPunto ?? 'unidad',
      tipo: reglaDb.tipo,
      id_regla: reglaDb.id_regla,
      empresa: reglaDb.empresa,
    };
  }
  const f = fallbackRegla(tipoCodigo);
  return {
    puntos_por_unidad: f.puntos_por_unidad,
    co2_por_unidad: f.co2_por_unidad,
    peso_kg_por_unidad: f.peso_kg_por_unidad,
    unidad: unidadPunto || f.unidad,
    tipo: { codigo: tipoCodigo, nombre: tipoCodigo, unidad_medida: f.unidad },
    id_regla: null,
  };
}

export async function cargarReglaParaPunto(prisma, punto) {
  if (punto.id_regla) {
    const regla = await prisma.reglaPunto.findUnique({
      where: { id_regla: punto.id_regla },
      include: {
        tipo: true,
        empresa: { select: { id_empresa: true, nombre: true } },
      },
    });
    if (regla && regla.estado === 'activo') {
      const now = new Date();
      if (regla.vigencia_inicio && new Date(regla.vigencia_inicio) > now) return null;
      if (regla.vigencia_fin && new Date(regla.vigencia_fin) < now) return null;
      return normalizarRegla(regla, punto.tipo_accion_permitida, punto.unidad);
    }
  }
  return normalizarRegla(null, punto.tipo_accion_permitida, punto.unidad);
}

export function calcularRecompensaPorRegla(regla, cantidad) {
  const qty = Number(cantidad) || 1;
  const pts = regla.puntos_por_unidad ?? 5;
  const ecocoins = Math.round(qty * pts);
  const peso_kg = Number((qty * (regla.peso_kg_por_unidad ?? 0.1)).toFixed(2));
  const co2_evitado = Number((qty * (regla.co2_por_unidad ?? 0.1)).toFixed(2));
  return { ecocoins, peso_kg, co2_evitado, puntos_por_unidad: pts };
}

export function estimarEcoCoins(regla, cantidad) {
  return calcularRecompensaPorRegla(regla, cantidad ?? 1).ecocoins;
}

/** @deprecated — usar calcularRecompensaPorRegla con regla cargada */
export function calcularRecompensaPorCantidad(tipoAccion, cantidad) {
  const regla = normalizarRegla(null, tipoAccion, null);
  return calcularRecompensaPorRegla(regla, cantidad);
}

export function formatearRespuestaResumen(tipo, cantidad, unidadPunto) {
  const qty = Number(cantidad);
  const u = unidadPunto || fallbackRegla(tipo).unidad;
  if (tipo === 'reciclaje_botellas') return `${qty} botella${qty !== 1 ? 's' : ''} de plástico`;
  if (tipo === 'reciclaje_papel') return `${qty} kg de papel/cartón`;
  if (tipo === 'eco_transporte') return `${qty} viaje${qty !== 1 ? 's' : ''} sostenible${qty !== 1 ? 's' : ''}`;
  return `${qty} ${u}`;
}

export function parseQrFromScan(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('punto');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return parts[parts.length - 1] || null;
  } catch {
    return text.replace(/^.*\/punto\//i, '').split(/[?#]/)[0] || text;
  }
}
