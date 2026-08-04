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

    // Reconcile in place: drop any key stripUnknown discarded from `value`
    // before merging the validated output back in. A plain Object.assign
    // only adds/overwrites keys — it never removes ones that Joi rejected,
    // so an unknown field (e.g. `role` on a register payload) would still
    // reach the controller. Mutating in place (not reassigning req[target])
    // is required because req.query is a read-only getter in Express 5.
    const current = req[target] as Record<string, unknown>;
    for (const key of Object.keys(current)) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        delete current[key];
      }
    }
    Object.assign(current, value);
    next();
  };
}
