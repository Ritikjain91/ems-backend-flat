// test-auth.js — Run with: node test-auth.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://jainritik829_db_user:dVid6JN68PxvyHdW@cluster0.kobrzsk.mongodb.net/?appName=Cluster0';

async function test() {
  console.log('Connecting to:', MONGO_URI.replace(/:([^@]+)@/, ':***@'));
  
  await mongoose.connect(MONGO_URI);
  console.log('Connected! DB:', mongoose.connection.name);
  
  // Import User model
  const User = require('./models/User').default;
  
  // Check existing users
  const users = await User.find({}, 'email role createdAt').lean();
  console.log('\nExisting users:', users.length);
  users.forEach(u => console.log('  -', u.email, '|', u.role, '|', u.createdAt));
  
  // Find admin
  const admin = await User.findOne({ email: 'admin@ems.com' }).select('+password');
  
  if (!admin) {
    console.log('\n❌ Admin user NOT FOUND');
    
    // Create admin
    console.log('Creating admin...');
    const newAdmin = await User.create({
      email: 'admin@ems.com',
      password: 'admin123',
      role: 'SUPER_ADMIN',
    });
    
    console.log('Created:', newAdmin._id);
    console.log('Password hash:', newAdmin.password);
    
    // Verify
    const verify = await newAdmin.comparePassword('admin123');
    console.log('Password verify:', verify);
    
  } else {
    console.log('\n✅ Admin found:', admin._id);
    console.log('Role:', admin.role);
    console.log('Password hash:', admin.password.substring(0, 30) + '...');
    console.log('Hash starts with $2:', admin.password.startsWith('$2'));
    
    // Test password
    const isMatch = await admin.comparePassword('admin123');
    console.log('Password matches "admin123":', isMatch);
    
    // Test wrong password
    const isWrong = await admin.comparePassword('wrongpassword');
    console.log('Password matches "wrongpassword":', isWrong);
    
    // If password doesn't match, reset it
    if (!isMatch) {
      console.log('\n⚠️ Password mismatch! Resetting...');
      admin.password = 'admin123';
      await admin.save();
      
      const verify = await admin.comparePassword('admin123');
      console.log('After reset, password matches:', verify);
    }
  }
  
  await mongoose.disconnect();
  console.log('\nDone.');
}

test().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});