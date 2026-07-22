// app.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import organizationRoutes from './routes/organization';
import dashboardRoutes from './routes/dashboard';
import departmentRoutes from "./routes/department.routes";


const app: Express = express();

// CORS — allow frontend origin
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// DEBUG: Log every request
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Auth header:', req.headers.authorization ? 'Bearer ***' : 'MISSING');
  next();
});

// Auth middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[Auth] ❌ No valid auth header');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    console.log('[Auth] ✅ Verified, userId:', decoded.userId);
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    console.log('[Auth] ❌ Failed:', err.message);
    return res.status(401).json({ message: 'Invalid token', error: err.message });
  }
};

// Public routes (no auth needed)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/employees', authenticate, employeeRoutes);
app.use('/api/organization', authenticate, organizationRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use("/api/departments", authenticate, departmentRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'OK' });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

export default app;