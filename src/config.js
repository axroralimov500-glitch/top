const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  dbPath: env.DB_PATH || './data/app.db',
  jwtSecret: env.JWT_SECRET || 'dev-jwt-secret-ozgartiring',
  paymentSecret: env.PAYMENT_SECRET || 'dev-payment-secret-ozgartiring',
  reservationTtlSec: Number(env.RESERVATION_TTL_SECONDS || 900),
  sweepIntervalSec: Number(env.SWEEP_INTERVAL_SECONDS || 30),
  // Admin ikkinchi paroli (2-bosqich). Hisob paroli emas — users.password_hash alohida.
  adminSecondPassword: env.ADMIN_SECOND_PASSWORD || 'devament',
  adminChallengeTtlSec: Number(env.ADMIN_2FA_CHALLENGE_SECONDS || 600),
};

if (config.jwtSecret.startsWith('dev-') || config.paymentSecret.startsWith('dev-')) {
  console.warn('[ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.');
}
