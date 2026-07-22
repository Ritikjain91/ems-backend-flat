import mongoose, { Schema, Document, Model } from 'mongoose';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type EmployeeRole = 'SUPER_ADMIN' | 'HR' | 'HR_MANAGER' | 'EMPLOYEE';

export interface IEmployee extends Document {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  salary: number;
  joiningDate: Date;
  status: EmployeeStatus;
  role: EmployeeRole;
  reportingManager?: mongoose.Types.ObjectId | null;
  profileImage?: string;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    phone: {
      type: String,
      required: true,
      match: [/^[0-9]{10}$/, 'Phone number must be 10 digits'],
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    salary: {
      type: Number,
      required: true,
      min: [0, 'Salary must be a positive number'],
    },
    joiningDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'],
      default: 'ACTIVE',
      set: (v: string) => (typeof v === 'string' ? v.toUpperCase() : v),
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'HR', 'HR_MANAGER', 'EMPLOYEE'],
      default: 'EMPLOYEE',
      set: (v: string) => (typeof v === 'string' ? v.toUpperCase() : v),
    },
    reportingManager: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

EmployeeSchema.index({ name: 'text', email: 'text' });

const Employee: Model<IEmployee> =
  (mongoose.models.Employee as Model<IEmployee>) ||
  mongoose.model<IEmployee>('Employee', EmployeeSchema);

export default Employee;