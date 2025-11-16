import { Schema, Document, Model } from 'mongoose';
import { getMongooseConnection } from '../../shared/database/mogoconfig';

export interface IToken extends Document {
  userId: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
}

const TokenSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const TokenModel: Model<IToken> = getMongooseConnection('auth').model<IToken>('Token', TokenSchema);

export default TokenModel;
