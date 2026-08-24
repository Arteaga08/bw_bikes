import Joi from "joi";

/**
 * Query-string whitelist for every `/admin/stats/*` endpoint. Coerces and
 * whitelists shape only — the actual date-window logic (defaulting,
 * `custom` requiring both bounds, the 365-day ceiling, `from < to`) lives in
 * `parseStatsRange` (utils/stats-range.ts), same split of responsibility as
 * `list-query.validator.ts` / `parseListQuery`.
 */
export const STATS_PRESETS = ["today", "7d", "30d", "90d", "365d", "custom"] as const;

export const statsRangeQuerySchema = Joi.object({
  preset: Joi.string()
    .valid(...STATS_PRESETS)
    .optional()
    .messages({ "any.only": `El preset debe ser uno de: ${STATS_PRESETS.join(", ")}.` }),
  from: Joi.string().isoDate().optional().messages({ "string.isoDate": '"from" debe ser una fecha ISO 8601.' }),
  to: Joi.string().isoDate().optional().messages({ "string.isoDate": '"to" debe ser una fecha ISO 8601.' }),
});
