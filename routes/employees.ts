import { Router, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import Employee from '../models/Employee';
import { protect, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// --- Multer setup ---------------------------------------------------------
// This is what actually parses multipart/form-data bodies. Without this,
// req.body is an EMPTY object for any FormData request — express.json() and
// express.urlencoded() cannot read multipart bodies at all. This was the
// cause of "Path `x` is required" for every field: the body was never being
// parsed, not a header/boundary issue on the client.
//
// Adjust `dest`/storage engine to match your existing setup (disk storage,
// S3, cloudinary, etc.) if you already have one configured elsewhere —
// import that instance instead of redefining it here.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB, matches frontend validation
});

// All employee routes require authentication
router.use(protect);

// --- Static/specific routes MUST come before dynamic :id routes ----------

// GET /api/employees/stats - dashboard stats
router.get('/stats', authorize('SUPER_ADMIN', 'HR'), async (req: AuthRequest, res: Response) => {
  try {
    const [totalEmployees, activeEmployees, inactiveEmployees, deptStats, monthlyTrend] =
      await Promise.all([
        Employee.countDocuments({}),
        Employee.countDocuments({ status: 'ACTIVE' }),
        Employee.countDocuments({ status: 'INACTIVE' }),
        Employee.aggregate([
          { $group: { _id: '$department', count: { $sum: 1 } } },
        ]),
        Employee.aggregate([
          {
            $group: {
              _id: { year: { $year: '$joiningDate' }, month: { $month: '$joiningDate' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        departmentCount: deptStats.length,
        deptStats,
        monthlyTrend,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/employees/departments - distinct department list
// This route was MISSING entirely, which is why requests fell through to
// GET /:id below (Express matches top-to-bottom) and 404'd on
// Employee.findById("departments").
router.get('/departments', async (req: AuthRequest, res: Response) => {
  try {
    const departments = await Employee.distinct('department');
    return res.status(200).json({
      success: true,
      data: departments.filter(Boolean).sort(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/employees - list with search, filter, sort, pagination
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, department, status, role, sort, page = '1', limit = '10' } = req.query;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { email: { $regex: search as string, $options: 'i' } },
      ];
    }
    if (department) query.department = department;
    if (status) query.status = status;
    if (role) query.role = role;

    if (req.user?.role === 'EMPLOYEE') {
      query._id = req.user.employeeId;
    }

    const sortMap: Record<string, string> = {
      joiningDate: 'joiningDate',
      name: 'name',
    };
    const sortField = sortMap[sort as string] || 'createdAt';

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit as string, 10) || 10, 1);

    const [data, total] = await Promise.all([
      Employee.find(query)
        .sort(sortField)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Employee.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/employees - Super Admin & HR only
// `upload.single('profileImage')` parses the multipart body into req.body
// (text fields) and req.file (the image), matching the FormData field names
// the frontend appends: data.append('profileImage', file) plus all the
// plain text fields via data.append(key, value).
router.post(
  '/',
  authorize('SUPER_ADMIN', 'HR'),
  upload.single('profileImage'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user?.role === 'HR' && req.body.role === 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'HR cannot assign Super Admin role' });
      }

      const payload = { ...req.body };
      if (req.file) {
        // Wire up to your actual storage/upload logic (disk path, S3 URL, etc.)
        // This assumes memoryStorage; adjust if you use a different engine.
        payload.profileImage = req.file.buffer
          ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
          : req.file.path;
      }

      const employee = await Employee.create(payload);
      return res.status(201).json({ success: true, data: employee });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/employees/:id - Super Admin & HR full edit; Employee limited self-edit
router.put(
  '/:id',
  upload.single('profileImage'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const isSelf = req.user?.employeeId === id;
      const isPrivileged = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'HR';

      if (!isPrivileged && !isSelf) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      if (req.user?.role === 'EMPLOYEE') {
        const restrictedFields = ['salary', 'role', 'status', 'reportingManager', 'employeeId'];
        const attemptedRestricted = restrictedFields.some((f) => f in req.body);
        if (attemptedRestricted) {
          return res.status(403).json({
            success: false,
            message: 'Employees cannot update restricted fields',
          });
        }
      }

      if (req.user?.role === 'HR' && req.body.role === 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'HR cannot assign Super Admin role' });
      }

      const payload = { ...req.body };
      if (req.file) {
        payload.profileImage = req.file.buffer
          ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
          : req.file.path;
      }

      const employee = await Employee.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      });

      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }

      return res.status(200).json({ success: true, data: employee });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/employees/:id - Super Admin only, soft delete
router.delete('/:id', authorize('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { status: 'INACTIVE' },
      { new: true }
    );
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    return res.status(200).json({ success: true, message: 'Employee deactivated', data: employee });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/employees/:id/reportees - direct reports of a manager
router.get('/:id/reportees', async (req: AuthRequest, res: Response) => {
  try {
    const reportees = await Employee.find({ reportingManager: req.params.id });
    return res.status(200).json({ success: true, data: reportees });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/employees/:id/manager - assign reporting manager, prevent cycles
router.patch(
  '/:id/manager',
  authorize('SUPER_ADMIN', 'HR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { managerId } = req.body;

      if (!managerId) {
        return res.status(400).json({ success: false, message: 'managerId is required' });
      }

      if (managerId === id) {
        return res.status(400).json({ success: false, message: 'An employee cannot manage themselves' });
      }

      const manager = await Employee.findById(managerId);
      if (!manager) {
        return res.status(404).json({ success: false, message: 'Manager not found' });
      }

      let current: mongoose.Types.ObjectId | null | undefined = manager.reportingManager;
      const visited = new Set<string>([id]);

      while (current) {
        if (visited.has(current.toString())) {
          return res.status(400).json({ success: false, message: 'Circular reporting detected' });
        }
        visited.add(current.toString());
        const next: any = await Employee.findById(current).select('reportingManager');
        current = next?.reportingManager || null;
      }

      const employee = await Employee.findByIdAndUpdate(
        id,
        { reportingManager: managerId },
        { new: true }
      );

      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }

      return res.status(200).json({ success: true, data: employee });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// GET /api/employees/:id - kept LAST among GET routes so /stats and
// /departments are matched first.
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role === 'EMPLOYEE' && req.user.employeeId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    return res.status(200).json({ success: true, data: employee });
  } catch (err: any) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }
});

export default router;