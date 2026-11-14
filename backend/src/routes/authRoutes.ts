import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/db';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
export const JWT_SECRET = process.env.JWT_SECRET || 'reachinbox_super_secret_jwt_key_2026';

/**
 * POST /api/auth/google
 * Real / Evaluator Google OAuth login handler
 * Accepts Google user payload (or decoded OAuth token)
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { email, name, avatar, googleId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required for Google authentication' });
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { googleId: googleId || undefined }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          avatar: avatar || 'https://lh3.googleusercontent.com/a/default-user=s96-c',
          googleId: googleId || `google-${Date.now()}`,
          password: null,
        },
      });
    } else if (avatar || name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: name || user.name,
          avatar: avatar || user.avatar,
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Google login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Google login failed: ' + err.message });
  }
});

/**
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        slackWebhookUrl: true,
        slackChannel: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  });
});

export default router;
