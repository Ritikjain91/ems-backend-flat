import { Request, Response } from "express";
import Department from "../models/Department";

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const department = await Department.create(req.body);

    res.status(201).json({
      success: true,
      data: department,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getDepartments = async (_req: Request, res: Response) => {
  const departments = await Department.find().sort({ name: 1 });

  res.json({
    success: true,
    data: departments,
  });
};