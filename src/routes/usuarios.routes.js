import { Router } from 'express';
import {
  getSaldo,
  getUsuario,
  getAccionesUsuario,
  getRanking,
} from '../controllers/usuarios.controller.js';

const router = Router();

router.get('/ranking/ecologico', getRanking);
router.get('/:id', getUsuario);
router.get('/:id/saldo', getSaldo);
router.get('/:id/acciones', getAccionesUsuario);

export default router;
