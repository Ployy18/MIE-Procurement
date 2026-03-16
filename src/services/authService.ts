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
    this.token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
      } catch (e) {
        this.logout();
      }
    }
  }

  async login(email: string, password: string) {
    console.log("🔐 [AuthService] Attempting login for:", email);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(
          "❌ [AuthService] Login failed with status:",
          response.status,
          text,
        );
        let errorData: any = null;
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          // ignore JSON parsing errors
        }
        if (errorData?.message === "Account is suspended") {
          throw new Error(
            "Your account has been suspended. Please contact the administrator.",
          );
        }
        if (response.status === 401) {
          throw new Error("Invalid email or password. Please try again.");
        }
        throw new Error("Login failed. Please try again later.");
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error("Invalid login response: Missing token");
      }

      this.token = data.token;
      this.user = data.user;

      localStorage.setItem("token", this.token as string);
      localStorage.setItem("user", JSON.stringify(this.user));

      console.log("✅ [AuthService] Login successful");
      return data;
    } catch (error: any) {
      console.error("❌ [AuthService] Login error:", error.message);
      throw error;
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
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

  // Validate token with local decode to check expiry
  async validateSession(): Promise<boolean> {
    if (!this.token) return false;

    try {
      // Simple JWT decode without library
      const base64Url = this.token.split(".")[1];
      if (!base64Url) return false;

      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(""),
      );

      const payload = JSON.parse(jsonPayload);

      // Check if expired
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        console.warn("⚠️ [AuthService] Token expired");
        this.logout();
        return false;
      }

      return true;
    } catch (error) {
      console.error("Session validation error:", error);
      this.logout();
      return false;
    }
  }
}

export const authService = new AuthService();
export default authService;
