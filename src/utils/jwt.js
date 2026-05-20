import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'ecoo_dev_secret';
const EXPIRES = '7d';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
