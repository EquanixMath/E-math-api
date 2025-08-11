import mongoose from 'mongoose';
import { MONGODB_URI } from './env.js';
// Global variable to store the connection
let isConnected = false;
const connectDB = async () => {
    // If already connected, return
    if (isConnected) {
        console.log('MongoDB already connected');
        return;
    }
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI not set in environment variables');
    }
    try {
        // Mongoose connection options for serverless
        const options = {
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            family: 4 // Use IPv4, skip trying IPv6
        };
        await mongoose.connect(MONGODB_URI, options);
        isConnected = true;
        console.log('MongoDB connected successfully');
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
};
// Handle connection events
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});
mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});
mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
    isConnected = false;
});
export default connectDB;
