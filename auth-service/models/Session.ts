import mongoose, { Schema, Document, Model } from 'mongoose';
import { getMongooseConnection } from '../../shared/database/mogoconfig';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
}

const SessionSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    token: {
      type: String,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
SessionSchema.index({ userId: 1 });
SessionSchema.index({ token: 1 });
SessionSchema.index({ expiresAt: 1 });

// Get model from connection
export function getSessionModel(): Model<ISession> {
  const connection = getMongooseConnection('auth');
  return connection.models.Session || connection.model<ISession>('Session', SessionSchema);
}
