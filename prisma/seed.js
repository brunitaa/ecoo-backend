import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "demo123";
const WEB_BASE = process.env.WEB_CIUDADANO_URL || "http://localhost:5173";

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  let plan = await prisma.planSuscripcion.findFirst({
    where: { nombre: "RSE Empresarial" },
  });
  if (!plan) {
    plan = await prisma.planSuscripcion.create({
      data: {
        nombre: "RSE Empresarial",
        costo_mensual: 500,
        limite_ecocoins_mes: 15000,
      },
    });
  }

  const juan = await prisma.usuario.upsert({
    where: { correo: "juan@upsa.edu" },
    update: { password_hash: hash },
    create: {
      nombre: "Juan Pérez",
      telefono: "+59170000001",
      correo: "juan@upsa.edu",
      password_hash: hash,
      universidad: "UPSA",
    },
  });

  const ana = await prisma.usuario.upsert({
    where: { correo: "ana@uagrm.edu" },
    update: { password_hash: hash },
    create: {
      nombre: "Ana Montero",
      telefono: "+59170000002",
      correo: "ana@uagrm.edu",
      password_hash: hash,
      universidad: "UAGRM",
    },
  });

  await prisma.administrador.upsert({
    where: { correo: "admin@ecoo.app" },
    update: { password_hash: hash },
    create: {
      nombre: "Moderador Ecoo",
      correo: "admin@ecoo.app",
      password_hash: hash,
      rol: "moderador",
    },
  });

  const empresasData = [
    {
      nombre: "Universidad Privada de Santa Cruz (UPSA)",
      tipo: "patrocinador_rse",
      correo: "sostenibilidad@upsa.edu",
      fecha: "2026-01-01",
    },
    {
      nombre: "Taza Eco Café",
      tipo: "socio_canje",
      correo: "canjes@tazaeco.bo",
      fecha: "2026-01-10",
    },
    {
      nombre: "VerdeMarket Equipetrol",
      tipo: "socio_canje",
      correo: "premios@verdemarket.bo",
      fecha: "2026-01-15",
    },
  ];

  const empresas = {};
  for (const e of empresasData) {
    let emp = await prisma.empresa.findFirst({
      where: { correo_contacto: e.correo },
    });
    if (!emp) {
      emp = await prisma.empresa.create({
        data: {
          nombre: e.nombre,
          tipo_empresa: e.tipo,
          correo_contacto: e.correo,
          password_hash: hash,
          id_plan_suscripcion: plan.id_plan,
          fecha_inicio: new Date(e.fecha),
        },
      });
    } else {
      await prisma.empresa.update({
        where: { id_empresa: emp.id_empresa },
        data: { password_hash: hash },
      });
    }
    empresas[e.correo] = emp;
  }

  const tiposData = [
    {
      codigo: "reciclaje_botellas",
      nombre: "Botellas plástico PET",
      unidad_medida: "botella",
    },
    {
      codigo: "reciclaje_papel",
      nombre: "Papel y cartón",
      unidad_medida: "kg",
    },
    {
      codigo: "eco_transporte",
      nombre: "Movilidad sostenible",
      unidad_medida: "viaje",
    },
  ];
  const tipos = {};
  for (const t of tiposData) {
    const row = await prisma.tipoReciclaje.upsert({
      where: { codigo: t.codigo },
      update: { nombre: t.nombre, unidad_medida: t.unidad_medida },
      create: t,
    });
    tipos[t.codigo] = row;
  }

  const reglasConfig = [
    {
      empresa: "sostenibilidad@upsa.edu",
      tipo: "reciclaje_botellas",
      pts: 6,
      co2: 0.05,
      kg: 0.03,
    },
    {
      empresa: "sostenibilidad@upsa.edu",
      tipo: "reciclaje_papel",
      pts: 12,
      co2: 0.4,
      kg: 1,
    },
    {
      empresa: "sostenibilidad@upsa.edu",
      tipo: "eco_transporte",
      pts: 20,
      co2: 2.1,
      kg: 0,
    },
    {
      empresa: "canjes@tazaeco.bo",
      tipo: "reciclaje_botellas",
      pts: 8,
      co2: 0.06,
      kg: 0.03,
    },
    {
      empresa: "premios@verdemarket.bo",
      tipo: "reciclaje_papel",
      pts: 10,
      co2: 0.35,
      kg: 1,
    },
  ];
  const reglas = {};
  for (const r of reglasConfig) {
    const emp = empresas[r.empresa];
    const tipo = tipos[r.tipo];
    const key = `${r.empresa}:${r.tipo}`;
    let regla = await prisma.reglaPunto.findFirst({
      where: { id_empresa: emp.id_empresa, id_tipo: tipo.id_tipo },
    });
    if (!regla) {
      regla = await prisma.reglaPunto.create({
        data: {
          id_empresa: emp.id_empresa,
          id_tipo: tipo.id_tipo,
          puntos_por_unidad: r.pts,
          co2_por_unidad: r.co2,
          peso_kg_por_unidad: r.kg,
          observaciones: `Acuerdo comercial demo — ${emp.nombre}`,
        },
      });
    } else {
      regla = await prisma.reglaPunto.update({
        where: { id_regla: regla.id_regla },
        data: { puntos_por_unidad: r.pts, estado: "activo" },
      });
    }
    reglas[key] = regla;
  }

  const puntosData = [
    {
      qr: "QR_UPSA_BOTELLAS_001",
      empresa: "sostenibilidad@upsa.edu",
      nombre: "Punto UPSA — Botellas PET",
      tipo: "reciclaje_botellas",
      pregunta: "¿Cuántas botellas de plástico estás depositando?",
      pregunta_tipo: "numero",
      unidad: "botellas",
      min: 1,
      max: 50,
      lat: -17.7833,
      lng: -63.1821,
    },
    {
      qr: "QR_UPSA_PAPEL_002",
      empresa: "sostenibilidad@upsa.edu",
      nombre: "Punto UPSA — Papel y Cartón",
      tipo: "reciclaje_papel",
      pregunta: "¿Cuántos kilogramos aproximados estás entregando?",
      pregunta_tipo: "kilogramos",
      unidad: "kg",
      min: 0.5,
      max: 25,
      lat: -17.784,
      lng: -63.1815,
    },
    {
      qr: "QR_EQUIPETROL_BIKE_003",
      empresa: "sostenibilidad@upsa.edu",
      nombre: "Punto Equipetrol — Movilidad Verde",
      tipo: "eco_transporte",
      pregunta:
        "¿Cuántos viajes en bici o transporte sostenible realizaste hoy?",
      pregunta_tipo: "numero",
      unidad: "viajes",
      min: 1,
      max: 3,
      lat: -17.77,
      lng: -63.19,
    },
    {
      qr: "QR_TAZA_ECO_VASOS_004",
      empresa: "canjes@tazaeco.bo",
      nombre: "Taza Eco — Vaso Reutilizable",
      tipo: "reciclaje_botellas",
      pregunta: "¿Cuántos envases plásticos evitaste trayendo tu vaso?",
      pregunta_tipo: "numero",
      unidad: "envases",
      min: 1,
      max: 10,
      lat: -17.786,
      lng: -63.175,
    },
    {
      qr: "QR_VERDEMARKET_CAJAS_005",
      empresa: "premios@verdemarket.bo",
      nombre: "VerdeMarket — Cartón de Empaque",
      tipo: "reciclaje_papel",
      pregunta: "¿Cuántos kilogramos de cartón estás reciclando?",
      pregunta_tipo: "kilogramos",
      unidad: "kg",
      min: 0.5,
      max: 15,
      lat: -17.765,
      lng: -63.168,
    },
  ];

  console.log("\n📍 URLs de prueba (escanea o abre en el navegador):\n");
  for (const p of puntosData) {
    const emp = empresas[p.empresa];
    const tipo = tipos[p.tipo];
    const regla = reglas[`${p.empresa}:${p.tipo}`];
    await prisma.puntoEcologico.upsert({
      where: { qr_codigo: p.qr },
      update: {
        pregunta_label: p.pregunta,
        pregunta_tipo: p.pregunta_tipo,
        unidad: p.unidad,
        min_cantidad: p.min,
        max_cantidad: p.max,
        tipo_accion_permitida: p.tipo,
        nombre_campana: "Campaña demo 2026",
        regla: { connect: { id_regla: regla.id_regla } },
        tipoReciclaje: { connect: { id_tipo: tipo.id_tipo } },
      },
      create: {
        nombre: p.nombre,
        qr_codigo: p.qr,
        tipo_accion_permitida: p.tipo,
        pregunta_label: p.pregunta,
        pregunta_tipo: p.pregunta_tipo,
        unidad: p.unidad,
        min_cantidad: p.min,
        max_cantidad: p.max,
        cooldown_horas: 4,
        ubicacion_lat: p.lat,
        ubicacion_lng: p.lng,
        nombre_campana: "Campaña demo 2026",
        empresa: { connect: { id_empresa: emp.id_empresa } },
        regla: { connect: { id_regla: regla.id_regla } },
        tipoReciclaje: { connect: { id_tipo: tipo.id_tipo } },
      },
    });
    console.log(`  ${p.nombre}`);
    console.log(`  → ${WEB_BASE}/punto/${p.qr}\n`);
  }

  const premios = [
    {
      empresa: "canjes@tazaeco.bo",
      titulo: "2x1 Café Americano",
      desc: "Taza Eco · Av. Busch — dos cafés por el precio de uno",
      costo: 50,
      stock: 40,
    },
    {
      empresa: "canjes@tazaeco.bo",
      titulo: "Café gratis + muffin",
      desc: "Taza Eco · muffin artesanal incluido",
      costo: 80,
      stock: 20,
    },
    {
      empresa: "premios@verdemarket.bo",
      titulo: "20% off productos orgánicos",
      desc: "VerdeMarket Equipetrol — descuento en línea eco",
      costo: 70,
      stock: 35,
    },
    {
      empresa: "premios@verdemarket.bo",
      titulo: "Bolsa reutilizable gratis",
      desc: "VerdeMarket — bolsa de yute con compra mínima",
      costo: 45,
      stock: 60,
    },
  ];

  for (const pr of premios) {
    const emp = empresas[pr.empresa];
    const exists = await prisma.recompensa.findFirst({
      where: { titulo: pr.titulo, id_empresa_proveedora: emp.id_empresa },
    });
    if (!exists) {
      await prisma.recompensa.create({
        data: {
          id_empresa_proveedora: emp.id_empresa,
          titulo: pr.titulo,
          descripcion: pr.desc,
          costo_ecocoins: pr.costo,
          stock_disponible: pr.stock,
        },
      });
    }
  }

  const accionesCount = await prisma.accion.count();
  if (accionesCount === 0) {
    const puntos = await prisma.puntoEcologico.findMany({
      where: {
        qr_codigo: { in: puntosData.map((point) => point.qr) },
      },
      select: { id_punto: true, qr_codigo: true },
    });

    const puntosByCode = Object.fromEntries(
      puntos.map((point) => [point.qr_codigo, point.id_punto]),
    );

    const accionesDemo = [
      {
        id_usuario: juan.id_usuario,
        qr: "QR_UPSA_BOTELLAS_001",
        cantidad: 12,
        ecocoins: 72,
        pesoKg: 12,
        co2: 0.6,
        estado: "aprobada",
        respuesta: "Botellas PET recicladas correctamente",
        fechaRegistro: "2026-05-10T09:20:00Z",
      },
      {
        id_usuario: ana.id_usuario,
        qr: "QR_UPSA_PAPEL_002",
        cantidad: 4,
        ecocoins: 48,
        pesoKg: 4,
        co2: 0.0,
        estado: "aprobada",
        respuesta: "Cartón y papel entregados",
        fechaRegistro: "2026-05-08T14:35:00Z",
      },
      {
        id_usuario: juan.id_usuario,
        qr: "QR_EQUIPETROL_BIKE_003",
        cantidad: 2,
        ecocoins: 40,
        pesoKg: 0,
        co2: 4.2,
        estado: "aprobada",
        respuesta: "Movilidad sostenible validada",
        fechaRegistro: "2026-05-15T08:15:00Z",
      },
      {
        id_usuario: ana.id_usuario,
        qr: "QR_TAZA_ECO_VASOS_004",
        cantidad: 5,
        ecocoins: 40,
        pesoKg: 0,
        co2: 0.2,
        estado: "pendiente",
        respuesta: "Revisión en espera de validación",
        fechaRegistro: "2026-05-18T11:00:00Z",
      },
      {
        id_usuario: juan.id_usuario,
        qr: "QR_VERDEMARKET_CAJAS_005",
        cantidad: 6,
        ecocoins: 60,
        pesoKg: 6,
        co2: 0.0,
        estado: "aprobada",
        respuesta: "Cartón reciclado en VerdeMarket",
        fechaRegistro: "2026-05-12T13:45:00Z",
      },
      {
        id_usuario: ana.id_usuario,
        qr: "QR_TAZA_ECO_VASOS_004",
        cantidad: 3,
        ecocoins: 24,
        pesoKg: 0,
        co2: 0.1,
        estado: "rechazada",
        respuesta: "Cantidad incompleta para validación",
        fechaRegistro: "2026-05-11T16:30:00Z",
      },
    ];

    await prisma.accion.createMany({
      data: accionesDemo.map((accion) => ({
        id_usuario: accion.id_usuario,
        id_punto: puntosByCode[accion.qr],
        foto_url: `${WEB_BASE}/images/sample-action-${accion.qr}.jpg`,
        cantidad_declarada: accion.cantidad,
        respuesta_resumen: accion.respuesta,
        estado_validacion: accion.estado,
        ecocoins_estimados: accion.ecocoins,
        ecocoins_ganados: accion.estado === "aprobada" ? accion.ecocoins : 0,
        peso_kg: accion.pesoKg,
        co2_evitado: accion.co2,
        fecha_registro: new Date(accion.fechaRegistro),
        fecha_validacion:
          accion.estado === "aprobada" ? new Date(accion.fechaRegistro) : null,
      })),
    });
  }

  const txCount = await prisma.transaccionEcocoin.count({
    where: { id_usuario: juan.id_usuario },
  });
  if (txCount === 0) {
    await prisma.transaccionEcocoin.create({
      data: { id_usuario: juan.id_usuario, tipo: "credito", monto: 250 },
    });
  }

  console.log("Seed completado. Contraseña demo: demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
