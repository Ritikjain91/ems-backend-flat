import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  try {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ems";

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);

      console.log("✅ MongoDB Connected");
    }
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error);
    process.exit(1);
  }
}