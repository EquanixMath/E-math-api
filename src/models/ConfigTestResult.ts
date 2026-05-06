import mongoose, { Document, Schema } from 'mongoose';

export interface IConfigTestResult extends Document {
  configId: string;
  configLabel: string;
  configCategory: string;
  configSpec: Record<string, any>;
  mode: string;
  totalTile: number;
  status: 'pass' | 'fail' | 'untested';
  successCount: number;
  failCount: number;
  attemptsCount: number;
  examples: string[];
  avgMs: number;
  errorMessage?: string;
  testedAt: Date;
  testedBy?: mongoose.Types.ObjectId;
}

const ConfigTestResultSchema = new Schema<IConfigTestResult>(
  {
    configId: { type: String, required: true, unique: true, index: true },
    configLabel: { type: String, required: true },
    configCategory: { type: String, required: true, default: 'misc' },
    configSpec: { type: Schema.Types.Mixed, required: true },
    mode: { type: String, required: true, default: 'cross' },
    totalTile: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pass', 'fail', 'untested'],
      default: 'untested',
    },
    successCount: { type: Number, default: 0 },
    failCount: { type: Number, default: 0 },
    attemptsCount: { type: Number, default: 0 },
    examples: [{ type: String }],
    avgMs: { type: Number, default: 0 },
    errorMessage: { type: String },
    testedAt: { type: Date, default: Date.now },
    testedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

ConfigTestResultSchema.index({ status: 1 });
ConfigTestResultSchema.index({ configCategory: 1, configId: 1 });

export default mongoose.model<IConfigTestResult>(
  'ConfigTestResult',
  ConfigTestResultSchema,
);
