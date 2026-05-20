-- Ecoo MVP — Esquema PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS planes_suscripcion (
  id_plan SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  costo_mensual DECIMAL(10,2) NOT NULL,
  limite_ecocoins_mes INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario SERIAL PRIMARY KEY,
  nombre VARCHAR(250) NOT NULL,
  telefono VARCHAR(50) UNIQUE NOT NULL,
  correo VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  foto_perfil_url TEXT NULL,
  universidad VARCHAR(100),
  fecha_registro TIMESTAMP DEFAULT NOW(),
  estado VARCHAR(20) DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS administradores (
  id_admin SERIAL PRIMARY KEY,
  nombre VARCHAR(250) NOT NULL,
  correo VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol VARCHAR(20) DEFAULT 'moderador'
);

CREATE TABLE IF NOT EXISTS empresas (
  id_empresa SERIAL PRIMARY KEY,
  nombre VARCHAR(250) NOT NULL,
  logo_url TEXT,
  tipo_empresa VARCHAR(50),
  correo_contacto VARCHAR(150) NOT NULL,
  id_plan_suscripcion INTEGER NOT NULL REFERENCES planes_suscripcion(id_plan),
  fecha_inicio DATE NOT NULL,
  estado VARCHAR(20) DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS puntos_ecologicos (
  id_punto SERIAL PRIMARY KEY,
  id_empresa INTEGER REFERENCES empresas(id_empresa),
  nombre VARCHAR(250) NOT NULL,
  ubicacion_lat DECIMAL(9,6) NOT NULL,
  ubicacion_lng DECIMAL(9,6) NOT NULL,
  tipo_accion_permitida VARCHAR(50) NOT NULL,
  qr_codigo VARCHAR(100) UNIQUE NOT NULL,
  estado VARCHAR(20) DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS acciones (
  id_accion SERIAL PRIMARY KEY,
  id_usuario INTEGER REFERENCES usuarios(id_usuario),
  id_punto INTEGER REFERENCES puntos_ecologicos(id_punto),
  foto_url TEXT NOT NULL,
  estado_validacion VARCHAR(20) DEFAULT 'pendiente',
  motivo_rechazo TEXT NULL,
  tipo_validador VARCHAR(20) DEFAULT 'manual',
  id_admin_validador INTEGER REFERENCES administradores(id_admin) NULL,
  ia_score_confianza DECIMAL(3,2) NULL,
  ia_metadatos JSONB NULL,
  ecocoins_ganados INTEGER DEFAULT 0,
  peso_kg DECIMAL(5,2) DEFAULT 0.00,
  co2_evitado DECIMAL(5,2) DEFAULT 0.00,
  fecha_registro TIMESTAMP DEFAULT NOW(),
  fecha_validacion TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS recompensas (
  id_recompensa SERIAL PRIMARY KEY,
  id_empresa_proveedora INTEGER REFERENCES empresas(id_empresa),
  titulo VARCHAR(250) NOT NULL,
  descripcion TEXT NOT NULL,
  costo_ecocoins INTEGER NOT NULL,
  stock_disponible INTEGER NOT NULL,
  stock_reservado INTEGER DEFAULT 0,
  fecha_inicio DATE,
  fecha_fin DATE,
  estado VARCHAR(20) DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS cupones (
  id_cupon SERIAL PRIMARY KEY,
  id_usuario INTEGER REFERENCES usuarios(id_usuario),
  id_recompensa INTEGER REFERENCES recompensas(id_recompensa),
  codigo_unico UUID UNIQUE DEFAULT uuid_generate_v4(),
  estado VARCHAR(20) DEFAULT 'disponible',
  fecha_generacion TIMESTAMP DEFAULT NOW(),
  fecha_canje TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS transacciones_ecocoins (
  id_transaccion SERIAL PRIMARY KEY,
  id_usuario INTEGER REFERENCES usuarios(id_usuario),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('credito', 'debito')),
  monto INTEGER NOT NULL,
  id_accion_origen INTEGER REFERENCES acciones(id_accion) NULL,
  id_cupon_destino INTEGER REFERENCES cupones(id_cupon) NULL,
  fecha TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transacciones_usuario ON transacciones_ecocoins(id_usuario);
CREATE INDEX IF NOT EXISTS idx_acciones_estado ON acciones(estado_validacion);
CREATE INDEX IF NOT EXISTS idx_cupones_codigo ON cupones(codigo_unico);
