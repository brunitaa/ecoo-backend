import { Router } from 'express';
import { validarCaja } from '../controllers/cupones.controller.js';

const router = Router();

router.post('/validar-caja', validarCaja);

export default router;
