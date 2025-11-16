import mongoose, { Connection } from 'mongoose';
import { logger } from '../util/logger';

const connections: Map<string, Connection> = new Map();

/**
 * Connect to MongoDB using Mongoose
 */
export async function connectMongoose(serviceName: string): Promise<Connection> {
  if (connections.has(serviceName)) {
    return connections.get(serviceName)!;
  }

  // Try service-specific DB URL first, then fallback to MONGODB_URL, then localhost
  let dbUrl = process.env[`${serviceName.toUpperCase()}_DB_URL`];
  const dbName = `bookmyshow_${serviceName}`;

  if (!dbUrl && process.env.MONGODB_URL) {
    const baseUrl = process.env.MONGODB_URL;

    // For mongodb+srv:// (Atlas), use the base URL and pass dbName as option
    if (baseUrl.includes('mongodb+srv://')) {
      dbUrl = baseUrl;
    }
    // For regular mongodb:// URLs, append database name
    else {
      // If URL has /? (no database specified), replace with /dbName?
      if (baseUrl.includes('/?')) {
        dbUrl = baseUrl.replace('/?', `/${dbName}?`);
      }
      // If URL has ? but no database path, insert database before ?
      else if (baseUrl.includes('?') && !baseUrl.match(/\/[^/?]+(\?|$)/)) {
        dbUrl = baseUrl.replace('?', `/${dbName}?`);
      }
      // If URL ends with /, append database name
      else if (baseUrl.endsWith('/')) {
        dbUrl = `${baseUrl}${dbName}`;
      }
      // Otherwise append /databaseName
      else {
        dbUrl = `${baseUrl}/${dbName}`;
      }
    }
  }

  // Final fallback to localhost
  if (!dbUrl) {
    dbUrl = `mongodb://localhost:27017/bookmyshow_${serviceName}`;
  }

  try {
    // For mongodb+srv:// URLs, pass database name as option to preserve authentication
    const connectionOptions = dbUrl.includes('mongodb+srv://') ? { dbName } : {};

    // Log connection attempt (without exposing full credentials)
    const maskedUrl = dbUrl.replace(/(mongodb\+srv?:\/\/)([^:]+):([^@]+)@/, '$1$2:***@');
    logger.info(`Attempting to connect to MongoDB for ${serviceName}...`);
    logger.debug(`Connection URL: ${maskedUrl}, Database: ${dbName}`);

    const connection = mongoose.createConnection(dbUrl, connectionOptions);
    await connection.asPromise();

    connection.on('error', (err) => {
      logger.error(`Mongoose connection error for ${serviceName}:`, err);
    });

    connection.on('disconnected', () => {
      logger.info(`Mongoose disconnected for ${serviceName}`);
    });

    connections.set(serviceName, connection);
    logger.info(`Mongoose connected for ${serviceName}`);

    return connection;
  } catch (error) {
    logger.error(`Mongoose connection error for ${serviceName}:`, error);
    throw error;
  }
}

/**
 * Get Mongoose connection
 */
export function getMongooseConnection(serviceName: string): Connection {
  const connection = connections.get(serviceName);
  if (!connection) {
    throw new Error(`Mongoose not connected for ${serviceName}. Call connectMongoose first`);
  }
  return connection;
}

/**
 * Close all Mongoose connections
 */
export async function closeAllMongooseConnections(): Promise<void> {
  const closePromises = Array.from(connections.values()).map((connection) => connection.close());
  await Promise.all(closePromises);
  connections.clear();
  logger.info('All Mongoose connections closed');
}

/**
 * Close a specific Mongoose connection
 */
export async function closeMongooseConnection(serviceName: string): Promise<void> {
  const connection = connections.get(serviceName);
  if (connection) {
    await connection.close();
    connections.delete(serviceName);
    logger.info(`Mongoose connection closed for ${serviceName}`);
  }
}
