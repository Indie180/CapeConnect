import { query } from '../db.js';
import { log, serializeError } from '../utils/logger.js';

const MAX_FAILED_ATTEMPTS = 5;

export async function checkAccountLockout(req, res, next) {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next();
    }

    const result = await query(`
      SELECT failed_attempts, locked_until 
      FROM users 
      WHERE email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return next(); // User doesn't exist, continue to normal auth flow
    }

    const user = result.rows[0];
    const now = new Date();
    
    if (user.locked_until && new Date(user.locked_until) > now) {
      const lockoutEnd = new Date(user.locked_until);
      const minutesLeft = Math.ceil((lockoutEnd - now) / (1000 * 60));
      
      return res.status(423).json({
        error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
        lockedUntil: user.locked_until
      });
    }

    // Clear expired lockout
    if (user.locked_until && new Date(user.locked_until) <= now) {
      await query(`
        UPDATE users 
        SET failed_attempts = 0, locked_until = NULL 
        WHERE email = $1
      `, [email]);
    }

    next();
  } catch (error) {
    next(error);
  }
}

export async function handleFailedLogin(email) {
  try {
    const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const result = await query(`
      UPDATE users
      SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
          locked_until = CASE
            WHEN COALESCE(failed_attempts, 0) + 1 >= $1
            THEN $3
            ELSE NULL
          END
      WHERE email = $2
      RETURNING failed_attempts, locked_until
    `, [MAX_FAILED_ATTEMPTS, email, lockoutUntil]);
    
    return result.rows[0];
  } catch (error) {
    log('error', 'Failed login handling error', { error: serializeError(error) });
    return null;
  }
}

export async function handleSuccessfulLogin(email) {
  try {
    await query(`
      UPDATE users 
      SET failed_attempts = 0, locked_until = NULL 
      WHERE email = $1
    `, [email]);
  } catch (error) {
    log('error', 'Successful login handling error', { error: serializeError(error) });
  }
}