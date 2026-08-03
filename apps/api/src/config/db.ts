import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * Opens the Mongo connection. Kept separate from server.ts so app.ts can be
 * imported (e.g. by supertest) without ever touching the database.
 */
export async function connectDb(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  const connection = await mongoose.connect(env.mongoUri);
  logger.info({ db: connection.connection.name }, "MongoDB connected");
  return connection;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected");
}
