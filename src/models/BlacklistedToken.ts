import mongoose, { Document, Schema } from 'mongoose';

export interface IBlacklistedToken extends Document {
  token: string;
  createdAt: Date;
}

const BlacklistedTokenSchema = new Schema<IBlacklistedToken>({
  token: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 } // TTL: 1 hour
});

export default mongoose.model<IBlacklistedToken>('BlacklistedToken', BlacklistedTokenSchema); 