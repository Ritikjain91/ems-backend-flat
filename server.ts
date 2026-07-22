import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT || 5000;

// Only connect + listen outside of tests. In tests, Jest connects to
// MONGO_TEST_URI itself and imports `app` directly via supertest.
if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to connect to database:', err);
      process.exit(1);
    });
}

export default app;
