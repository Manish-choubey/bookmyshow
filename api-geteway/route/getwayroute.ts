import { Router } from 'express';
import { GatewayController } from '../controller/gatewayController';

const router = Router();

// Proxy all auth routes to auth service
router.use('/auth', GatewayController.proxyToAuth);

export default router;
