import app from './app.js';
import connectDB from './config/db.js';

const port = process.env.PORT || 3001;

// Connect to database before starting server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();