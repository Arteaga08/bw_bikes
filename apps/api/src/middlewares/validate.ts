import type { NextFunction, Request, Response } from "express";
import type { ObjectSchema } from "joi";
import { AppError } from "../utils/index.js";

type ValidationTarget = "body" | "params" | "query";

/**
 * Validates `req[target]` against a Joi schema with `stripUnknown: true`
 * (blocks mass-assignment by discarding fields the schema doesn't declare)
 * and replaces the request data with the validated, coerced output. Every
 * endpoint that receives external input goes through this.
 */
export function validate(schema: ObjectSchema, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((detail) => detail.message).join("; ");
      next(new AppError(message, 400));
      return;
    }

    Object.assign(req[target], value);
    next();
  };
}
