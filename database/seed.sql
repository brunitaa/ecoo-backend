-- Datos de demostración Ecoo MVP (idempotente)

INSERT INTO planes_suscripcion (nombre, costo_mensual, limite_ecocoins_mes)
SELECT 'RSE Empresarial', 500.00, 10000
WHERE NOT EXISTS (SELECT 1 FROM planes_suscripcion WHERE nombre = 'RSE Empresarial');

INSERT INTO usuarios (nombre, telefono, correo, password_hash, universidad)
SELECT 'Juan Pérez', '+59170000001', 'juan@upsa.edu', '$2a$10$5CiT/UPPvMHz3O.qPEUl6exMDOCgHT4HEZiXAYdW4hZCqJuky39Xy', 'UPSA'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE correo = 'juan@upsa.edu');

INSERT INTO usuarios (nombre, telefono, correo, password_hash, universidad)
SELECT 'Ana Montero', '+59170000002', 'ana@uagrm.edu', '$2a$10$5CiT/UPPvMHz3O.qPEUl6exMDOCgHT4HEZiXAYdW4hZCqJuky39Xy', 'UAGRM'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE correo = 'ana@uagrm.edu');

INSERT INTO administradores (nombre, correo, password_hash, rol)
SELECT 'Moderador Ecoo', 'admin@ecoo.app', '$2a$10$5CiT/UPPvMHz3O.qPEUl6exMDOCgHT4HEZiXAYdW4hZCqJuky39Xy', 'moderador'
WHERE NOT EXISTS (SELECT 1 FROM administradores WHERE correo = 'admin@ecoo.app');

INSERT INTO empresas (nombre, tipo_empresa, correo_contacto, password_hash, id_plan_suscripcion, fecha_inicio)
SELECT 'Banco Ecológico S.A.', 'patrocinador_rse', 'rse@bancoeco.bo', '$2a$10$5CiT/UPPvMHz3O.qPEUl6exMDOCgHT4HEZiXAYdW4hZCqJuky39Xy', id_plan, '2026-01-01'
FROM planes_suscripcion WHERE nombre = 'RSE Empresarial'
AND NOT EXISTS (SELECT 1 FROM empresas WHERE nombre = 'Banco Ecológico S.A.');

INSERT INTO empresas (nombre, tipo_empresa, correo_contacto, password_hash, id_plan_suscripcion, fecha_inicio)
SELECT 'Taza Eco', 'socio_canje', 'canjes@tazaeco.bo', '$2a$10$5CiT/UPPvMHz3O.qPEUl6exMDOCgHT4HEZiXAYdW4hZCqJuky39Xy', id_plan, '2026-01-15'
FROM planes_suscripcion WHERE nombre = 'RSE Empresarial'
AND NOT EXISTS (SELECT 1 FROM empresas WHERE nombre = 'Taza Eco');

INSERT INTO puntos_ecologicos (id_empresa, nombre, ubicacion_lat, ubicacion_lng, tipo_accion_permitida, qr_codigo)
SELECT e.id_empresa, 'Punto UPSA-A', -17.783300, -63.182100, 'reciclaje', 'ECOO-UPSA-A-2026'
FROM empresas e WHERE e.nombre = 'Banco Ecológico S.A.'
AND NOT EXISTS (SELECT 1 FROM puntos_ecologicos WHERE qr_codigo = 'ECOO-UPSA-A-2026');

INSERT INTO puntos_ecologicos (id_empresa, nombre, ubicacion_lat, ubicacion_lng, tipo_accion_permitida, qr_codigo)
SELECT e.id_empresa, 'Punto UAGRM', -17.392500, -66.165000, 'transporte', 'ECOO-UAGRM-T-2026'
FROM empresas e WHERE e.nombre = 'Banco Ecológico S.A.'
AND NOT EXISTS (SELECT 1 FROM puntos_ecologicos WHERE qr_codigo = 'ECOO-UAGRM-T-2026');

INSERT INTO recompensas (id_empresa_proveedora, titulo, descripcion, costo_ecocoins, stock_disponible, estado)
SELECT e.id_empresa, 'Café gratis', 'Taza Eco · Santa Cruz — una taza de café orgánico', 60, 23, 'activo'
FROM empresas e WHERE e.nombre = 'Taza Eco'
AND NOT EXISTS (SELECT 1 FROM recompensas WHERE titulo = 'Café gratis' AND id_empresa_proveedora = e.id_empresa);

INSERT INTO recompensas (id_empresa_proveedora, titulo, descripcion, costo_ecocoins, stock_disponible, estado)
SELECT e.id_empresa, '20% off eco tienda', 'EcoStore · La Ramada — descuento en productos sostenibles', 80, 50, 'activo'
FROM empresas e WHERE e.nombre = 'Taza Eco'
AND NOT EXISTS (SELECT 1 FROM recompensas WHERE titulo = '20% off eco tienda' AND id_empresa_proveedora = e.id_empresa);

INSERT INTO recompensas (id_empresa_proveedora, titulo, descripcion, costo_ecocoins, stock_disponible, estado)
SELECT e.id_empresa, 'Día de gym gratis', 'FitGreen · Equipetrol', 120, 10, 'activo'
FROM empresas e WHERE e.nombre = 'Taza Eco'
AND NOT EXISTS (SELECT 1 FROM recompensas WHERE titulo = 'Día de gym gratis' AND id_empresa_proveedora = e.id_empresa);

INSERT INTO transacciones_ecocoins (id_usuario, tipo, monto)
SELECT u.id_usuario, 'credito', 250
FROM usuarios u WHERE u.correo = 'juan@upsa.edu'
AND NOT EXISTS (SELECT 1 FROM transacciones_ecocoins t WHERE t.id_usuario = u.id_usuario);
