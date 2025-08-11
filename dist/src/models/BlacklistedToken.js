import mongoose, { Document, Schema } from 'mongoose';
const BlacklistedTokenSchema = new Schema({
    token: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now, expires: 3600 } // TTL: 1 hour
});
export default mongoose.model('BlacklistedToken', BlacklistedTokenSchema);
