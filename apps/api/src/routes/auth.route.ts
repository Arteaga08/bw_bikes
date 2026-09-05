import { Router } from "express";
import {
  completeTwoFactorEnrollmentHandler,
  disableTwoFactorHandler,
  forgotPasswordHandler,
  login,
  logoutAllHandler,
  logoutHandler,
  me,
  refresh,
  register,
  resendVerification,
  resetPasswordHandler,
  startTwoFactorEnrollmentHandler,
  verifyEmailHandler,
  verifyTwoFactorHandler,
} from "../controllers/auth.controller.js";
import {
  authActionRateLimiter,
  loginRateLimiter,
  protect,
  refreshRateLimiter,
  restrictTo,
  twoFactorRateLimiter,
  validate,
} from "../middlewares/index.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  verifyEmailSchema,
} from "../validators/index.js";

const router = Router();

router.post("/register", authActionRateLimiter, validate(registerSchema), register);
// The token is a 64-hex CSPRNG value (crypto.ts), so this isn't a
// brute-force target the way login or a TOTP code is — but it's still an
// anonymous DB lookup-and-write with no ceiling of its own otherwise, sharing
// only the 1000/15min global backstop. Same bucket as its siblings below.
router.post("/verify-email", authActionRateLimiter, validate(verifyEmailSchema), verifyEmailHandler);
router.post("/resend-verification", authActionRateLimiter, validate(resendVerificationSchema), resendVerification);

router.post("/login", loginRateLimiter, validate(loginSchema), login);

// enroll/start doesn't check a secret (it just mints a fresh one behind an
// already-issued challenge cookie), so it's not brute-forceable and needs no
// limiter for that reason — reaching it at all already required a correct
// password past `loginRateLimiter`. It still gets `twoFactorRateLimiter`
// as a ceiling on repeated work (AES-encrypting and persisting a fresh TOTP
// secret per call), not as a guessing guard. Everything below it DOES check
// a 6-digit TOTP code — only 10^6 possibilities per 30s window — so it needs
// the same brute-force guard as password login. On its own bucket
// (`twoFactorRateLimiter`), not `loginRateLimiter`: a legitimate first-time
// enrollment already spends a request on /login before it ever reaches a
// code check, so sharing one budget across the whole flow would lock a real
// admin out of their own account. BACKEND_SECURITY_GUIDELINES.md §7's "no
// throttle admin routes" targets ordinary admin work; a second-factor code
// guess is the credential check itself, not routine work — hence
// /2fa/disable is limited too, despite sitting behind `protect`.
router.post("/2fa/enroll/start", twoFactorRateLimiter, startTwoFactorEnrollmentHandler);
router.post(
  "/2fa/enroll/complete",
  twoFactorRateLimiter,
  validate(twoFactorCodeSchema),
  completeTwoFactorEnrollmentHandler,
);
router.post("/2fa/verify", twoFactorRateLimiter, validate(twoFactorCodeSchema), verifyTwoFactorHandler);
router.post(
  "/2fa/disable",
  protect,
  restrictTo("admin", "superadmin"),
  twoFactorRateLimiter,
  validate(twoFactorCodeSchema),
  disableTwoFactorHandler,
);

router.post("/refresh", refreshRateLimiter, refresh);
// Presenting a refresh cookie is not a credential guess, but logout is still a
// cheap, unauthenticated-in-effect endpoint (any cookie value reaches the
// handler) worth the same baseline throttle as the other auth actions above.
router.post("/logout", authActionRateLimiter, logoutHandler);
router.post("/logout-all", protect, logoutAllHandler);

router.post("/forgot-password", authActionRateLimiter, validate(forgotPasswordSchema), forgotPasswordHandler);
router.post("/reset-password", authActionRateLimiter, validate(resetPasswordSchema), resetPasswordHandler);

router.get("/me", protect, me);

export { router as authRouter };
