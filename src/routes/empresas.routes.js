import { Router } from 'express';
import { getKpis, getQrsEmpresa, getAnalytics } from '../controllers/empresas.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:id/kpis', requireAuth, getKpis);
router.get('/:id/analytics', requireAuth, getAnalytics);
router.get('/:id/qrs', requireAuth, getQrsEmpresa);

export default router;
