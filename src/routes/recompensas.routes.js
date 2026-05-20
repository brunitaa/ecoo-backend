import { Router } from 'express';
import {
  listarRecompensas,
  canjearRecompensa,
} from '../controllers/recompensas.controller.js';

const router = Router();

router.get('/', listarRecompensas);
router.post('/canjear', canjearRecompensa);

export default router;
