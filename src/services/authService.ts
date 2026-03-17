import { API_BASE } from "../config/apiConfig";

export interface User {
  id: string;
  email: string;
  role: "admin" | "user";
}

class AuthService {
  private user: User | null = null;
  private token: string | null = null;

  constructor() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  async login(email: string, password: string) {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();
      let errorData: any = null;

      try {
        errorData = JSON.parse(text);
      } catch {}

      if (!response.ok) {
        if (errorData?.message === "Account is suspended") {
          throw new Error("Your account has been suspended.");
        }

        if (response.status === 401) {
          throw new Error("Invalid email or password.");
        }

        throw new Error("Login failed.");
      }

      const data = JSON.parse(text);

      if (!data.token) {
        throw new Error("Missing token");
      }

      this.token = data.token;
      this.user = data.user;

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(this.user));

      return data;
    } catch (error: any) {
      console.error("❌ Login error:", error.message);
      throw error;
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  getCurrentUser(): User | null {
    return this.user;
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  isAdmin(): boolean {
    return this.user?.role === "admin";
  }

  async validateSession(): Promise<boolean> {
    if (!this.token) return false;

    try {
      const base64Url = this.token.split(".")[1];
      if (!base64Url) return false;

      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );

      const payload = JSON.parse(jsonPayload);

      if (payload.exp && Date.now() >= payload.exp * 1000) {
        console.warn("⚠️ Token expired");

        localStorage.removeItem("token");
        localStorage.removeItem("user");
        this.token = null;
        this.user = null;

        return false;
      }

      return true;
    } catch (error) {
      console.error("Session validation error:", error);

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      this.token = null;
      this.user = null;

      return false;
    }
  }
}

export const authService = new AuthService();
export default authService;
