import { SignJWT, jwtVerify } from "jose";

export interface JwtPayload {
  userId: string;
  email: string;
}

export class JwtService {
  private secret: Uint8Array;
  private issuer = "desk-agent";
  private audience = "desk-agent-api";

  constructor(secretKey: string) {
    this.secret = new TextEncoder().encode(secretKey);
  }

  async generateAccessToken(payload: JwtPayload): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setExpirationTime("1h")
      .sign(this.secret);
  }

  async generateRefreshToken(payload: JwtPayload): Promise<string> {
    return new SignJWT({ ...payload, type: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setExpirationTime("7d")
      .sign(this.secret);
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    const { payload } = await jwtVerify(token, this.secret, {
      issuer: this.issuer,
      audience: this.audience,
    });
    return {
      userId: payload["userId"] as string,
      email: payload["email"] as string,
    };
  }
}
