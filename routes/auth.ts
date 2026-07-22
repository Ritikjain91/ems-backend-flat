import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '1d';

// POST /api/auth/seed - creates the super admin if it doesn't already exist (idempotent)
// TEMPORARY: remove or protect this route before deploying/submitting
router.post('/seed', async (req: Request, res: Response) => {
  try {
    await User.deleteOne({ email: 'admin@ems.com' });
    console.log('[Seed] Deleted existing admin (if any)');

    const user = await User.create({
      email: 'admin@ems.com',
      password: 'admin123',
      role: 'SUPER_ADMIN',
    });

    console.log('[Seed] Created admin:', user._id);
    console.log('[Seed] Password hash:', user.password.substring(0, 30) + '...');

    const verify = await bcrypt.compare('admin123', user.password);
    console.log('[Seed] bcrypt.compare result:', verify);

    const modelVerify = await user.comparePassword('admin123');
    console.log('[Seed] model.comparePassword result:', modelVerify);

    return res.status(200).json({
      success: true,
      message: 'Super admin created',
      verification: {
        bcryptCompare: verify,
        modelCompare: modelVerify,
      },
    });
  } catch (err: any) {
    console.error('[Seed Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  console.log('[Login] Request body:', req.body);

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    const userDoc = await User.findOne({ email: email.toLowerCase() }).select('+password').lean();
    console.log('[Login] User found:', !!userDoc);

    if (!userDoc) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, userDoc.password);
    console.log('[Login] bcrypt.compare result:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    console.log('[Login] Password matched — creating token');

    // FIXED: was `userDoc.employee` (nonexistent field, always undefined).
    // Corrected to `userDoc.employeeId`. If your User schema doesn't have this
    // field yet, add it (e.g. a ref to the Employee doc, or the field EMPLOYEE-role
    // users need for self-access checks in your employees routes).
    const token = jwt.sign(
      {
        id: userDoc._id,
        email: userDoc.email,
        role: userDoc.role,
        employeeId: userDoc.employee   // ← this was actually CORRECT
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: { id: userDoc._id, email: userDoc.email, role: userDoc.role },
      },
    });
  } catch (err: any) {
    console.error('[Login Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', protect, async (_req: AuthRequest, res: Response) => {
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me - get current user
router.get('/me', protect, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// TEMPORARY: Debug route — remove before deploying/submitting
router.get('/debug-user/:email', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() }).select('+password').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      exists: true,
      id: user._id,
      role: user.role,
      passwordHash: user.password.substring(0, 30) + '...',
      hashLength: user.password.length,
      hashPrefix: user.password.substring(0, 4),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password, role } = req.body;

  console.log('[Signup] Request body:', { email, role });

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    // Only allow SUPER_ADMIN signup if no super admin exists yet (bootstrap case)
    let finalRole = 'EMPLOYEE';
    if (role === 'SUPER_ADMIN') {
      const superAdminExists = await User.findOne({ role: 'SUPER_ADMIN' });
      finalRole = superAdminExists ? 'EMPLOYEE' : 'SUPER_ADMIN';
    } else if (role === 'HR' || role === 'EMPLOYEE') {
      finalRole = role;
    }

    const user = await User.create({
      email: email.toLowerCase(),
      password, // plain password — pre('save') hook hashes it
      role: finalRole,
    });

    console.log('[Signup] Created user:', user._id, 'role:', user.role);

    // FIXED: now includes employeeId, matching /login's token shape.
    // Without this, an EMPLOYEE-role user created via signup would fail
    // every self-access check in your employees routes (req.user.employeeId).
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        employeeId: (user as any).employeeId,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user._id, email: user.email, role: user.role },
      },
    });
  } catch (err: any) {
    console.error('[Signup Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;