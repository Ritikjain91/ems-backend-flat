import { Router, Response } from 'express';
import Employee from '../models/Employee';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

// GET /api/dashboard/stats
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [totalEmployees, activeEmployees, inactiveEmployees, departments] = await Promise.all([
      Employee.countDocuments({}),
      Employee.countDocuments({ status: 'ACTIVE' }),
      Employee.countDocuments({ status: 'INACTIVE' }),
      Employee.distinct('department'),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        departmentCount: departments.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
