import { Router } from 'express';
import { registrarAccion } from '../controllers/acciones.controller.js';

const router = Router();

router.post('/registrar', registrarAccion);

export default router;
