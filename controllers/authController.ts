import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export const signup = async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      name,
      email,
      password,
      phone,
      department,
      designation,
      salary,
      joiningDate,
      role,
    } = req.body;

    // Basic validation
    if (!employeeId || !name || !email || !password || !phone || !department || !designation || !salary || !joiningDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Prevent public self-assignment of super_admin unless no super admin exists yet
    let finalRole = 'employee';
    if (role === 'super_admin') {
      const superAdminExists = await User.findOne({ role: 'super_admin' });
      if (!superAdminExists) {
        finalRole = 'super_admin'; // allow bootstrapping the first admin only
      }
    } else if (role === 'hr' || role === 'employee') {
      finalRole = role;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      employeeId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      department,
      designation,
      salary,
      joiningDate,
      role: finalRole,
      status: 'active',
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    return res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[Signup] Error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};