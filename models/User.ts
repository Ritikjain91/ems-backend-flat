import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcrypt';

export type UserRole = 'SUPER_ADMIN' | 'HR' | 'EMPLOYEE';

export interface IUser extends Document {
  email: string;
  password: string;
  role: UserRole;
  employee?: mongoose.Types.ObjectId; // link to Employee profile, if any
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'HR', 'EMPLOYEE'],
      default: 'EMPLOYEE',
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
    },
  },
  { timestamps: true }
);

// Hash password before saving, only if it was modified
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

// Never leak password hash in JSON responses
UserSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.password;
    return ret;
  },
});

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default User;
