import { Router } from 'express';
import {
  listarPendientes,
  verificarAccion,
  listarProcesadas,
} from '../controllers/admin.controller.js';
import {
  listarEmpresas,
  actualizarEmpresa,
  listarTipos,
  listarReglas,
  crearRegla,
  actualizarRegla,
  listarQrs,
  crearQr,
  actualizarQr,
} from '../controllers/admin-mgmt.controller.js';
import { getDashboardStats } from '../controllers/admin-dashboard.controller.js';

const router = Router();

router.get('/acciones/pendientes', listarPendientes);
router.get('/acciones/procesadas', listarProcesadas);
router.post('/verificar-accion', verificarAccion);
router.get('/dashboard', getDashboardStats);

router.get('/empresas', listarEmpresas);
router.patch('/empresas/:id', actualizarEmpresa);
router.get('/tipos-reciclaje', listarTipos);
router.get('/reglas', listarReglas);
router.post('/reglas', crearRegla);
router.patch('/reglas/:id', actualizarRegla);
router.get('/qrs', listarQrs);
router.post('/qrs', crearQr);
router.patch('/qrs/:id', actualizarQr);

export default router;
