
import mongoose, { Schema, Document } from "mongoose";

export interface IDepartment extends Document {
  name: string;
  description?: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const Department = mongoose.model<IDepartment>(
  "Department",
  departmentSchema
);

export default Department;