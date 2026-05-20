/**
 * Saldo real desde transacciones (SUM dinámico — nunca columna estática).
 */
export async function calcularSaldo(db, idUsuario) {
  const result = await db.$queryRaw`
    SELECT COALESCE(SUM(
      CASE WHEN tipo = 'credito' THEN monto ELSE -monto END
    ), 0)::INTEGER AS saldo
    FROM transacciones_ecocoins
    WHERE id_usuario = ${Number(idUsuario)}
  `;
  return Number(result[0]?.saldo ?? 0);
}
