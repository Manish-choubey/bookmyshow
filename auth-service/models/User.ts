import mongoose, { Schema, Document, Model } from 'mongoose';
import { getMongooseConnection } from '../../shared/database/mogoconfig';

export interface IUser extends Document {
  email: string;
  name: string;
  password: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      require: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      require: true,
      trim: true,
    },

    password: {
      type: String,
      require: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
    },
  },
  {
    timestamps: true,
  },
);

export function getUserModel(): Model<IUser> {
  const connection = getMongooseConnection('auth');
  return connection.models.User || connection.model<IUser>('User', UserSchema);
}
