import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { PgUserRepository } from "../../repositories/pg-user.repository.js";
import type { JwtService } from "../../services/jwt.service.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export function createAuthRoutes(
  userRepository: PgUserRepository,
  jwtService: JwtService
): Hono {
  const routes = new Hono();

  // POST /auth/register
  routes.post("/register", zValidator("json", registerSchema), async (c) => {
    const body = c.req.valid("json");

    const existing = await userRepository.findByEmail(body.email);
    if (existing) {
      return c.json({ error: "Email already registered" }, 400);
    }

    const user = await userRepository.create({
      email: body.email,
      password: body.password,
      name: body.name,
    });

    const accessToken = await jwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
    });
    const refreshToken = await jwtService.generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    }, 201);
  });

  // POST /auth/login
  routes.post("/login", zValidator("json", loginSchema), async (c) => {
    const body = c.req.valid("json");

    const user = await userRepository.verifyPassword(body.email, body.password);
    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const accessToken = await jwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
    });
    const refreshToken = await jwtService.generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    });
  });

  // POST /auth/refresh
  routes.post("/refresh", zValidator("json", refreshSchema), async (c) => {
    const body = c.req.valid("json");

    try {
      const payload = await jwtService.verifyToken(body.refreshToken);
      const user = await userRepository.findById(payload.userId);

      if (!user) {
        return c.json({ error: "User not found" }, 401);
      }

      const accessToken = await jwtService.generateAccessToken({
        userId: user.id,
        email: user.email,
      });

      return c.json({ accessToken });
    } catch {
      return c.json({ error: "Invalid refresh token" }, 401);
    }
  });

  // GET /auth/me (requires auth)
  routes.get("/me", async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const user = await userRepository.findById(auth.userId);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  });

  return routes;
}
