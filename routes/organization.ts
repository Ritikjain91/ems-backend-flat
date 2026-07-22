import { Router, Response } from 'express';
import Employee, { IEmployee } from '../models/Employee';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

type TreeNode = {
  _id: string;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  children: TreeNode[];
};

// GET /api/organization/tree
router.get('/tree', async (_req: AuthRequest, res: Response) => {
  try {
    const employees = await Employee.find({ status: 'ACTIVE' }).lean();

    const nodeMap = new Map<string, TreeNode>();
    employees.forEach((e: any) => {
      nodeMap.set(e._id.toString(), {
        _id: e._id.toString(),
        employeeId: e.employeeId,
        name: e.name,
        designation: e.designation,
        department: e.department,
        children: [],
      });
    });

    const roots: TreeNode[] = [];

    employees.forEach((e: any) => {
      const node = nodeMap.get(e._id.toString())!;
      if (e.reportingManager && nodeMap.has(e.reportingManager.toString())) {
        nodeMap.get(e.reportingManager.toString())!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return res.status(200).json({ success: true, data: roots });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/organization/:id/manager - assign or change an employee's reporting manager
router.patch('/:id/manager', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    if (managerId === id) {
      return res.status(400).json({ success: false, message: 'An employee cannot be their own manager' });
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (managerId) {
      const manager = await Employee.findById(managerId);
      if (!manager) {
        return res.status(404).json({ success: false, message: 'Manager not found' });
      }

      // Prevent circular reporting: walk up the chain from the proposed manager.
      // If the employee being updated shows up anywhere in that chain, assigning
      // this manager would create a cycle, so we reject it.
      let current: any = manager;
      const visited = new Set<string>();
      while (current?.reportingManager) {
        const currentManagerId = current.reportingManager.toString();
        if (currentManagerId === id) {
          return res.status(400).json({
            success: false,
            message: 'This assignment would create a circular reporting relationship',
          });
        }
        if (visited.has(currentManagerId)) break; // safety net for any pre-existing bad data
        visited.add(currentManagerId);
        current = await Employee.findById(currentManagerId);
      }
    }

    employee.reportingManager = managerId || undefined;
    await employee.save();

    return res.status(200).json({ success: true, data: employee });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;