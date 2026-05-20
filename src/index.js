import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './config/prisma.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import accionesRoutes from './routes/acciones.routes.js';
import recompensasRoutes from './routes/recompensas.routes.js';
import cuponesRoutes from './routes/cupones.routes.js';
import adminRoutes from './routes/admin.routes.js';
import puntosRoutes from './routes/puntos.routes.js';
import authRoutes from './routes/auth.routes.js';
import empresasRoutes from './routes/empresas.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5170,http://localhost:5173,http://localhost:5174,http://localhost:5175')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Ecoo API', version: '1.0.0' });
});

app.use('/api/usuarios', usuariosRoutes);
app.use('/api/acciones', accionesRoutes);
app.use('/api/recompensas', recompensasRoutes);
app.use('/api/cupones', cuponesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/puntos', puntosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresasRoutes);

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Ecoo API escuchando en http://localhost:${PORT}`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
