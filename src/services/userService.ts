import authService from "./authService";
import { API_BASE } from "../config/apiConfig";

export interface UserDetail {
  id: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "suspended";
  created_at: string;
}

class UserService {
  private getHeaders() {
    const token = authService.getToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async getUsers(): Promise<UserDetail[]> {
    const response = await fetch(`${API_BASE}/getUsers`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch users");
    }
    return response.json();
  }

  async createUser(userData: {
    email: string;
    password: string;
    role: string;
  }): Promise<UserDetail> {
    const response = await fetch(`${API_BASE}/createUser`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create user");
    }
    const result = await response.json();
    return result.user;
  }

  async updateUser(userData: {
    id: string;
    email?: string;
    role?: string;
    status?: string;
  }): Promise<UserDetail> {
    const response = await fetch(`${API_BASE}/updateUser`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update user");
    }
    const result = await response.json();
    return result.user;
  }

  async deleteUser(id: string): Promise<void> {
    console.log("🗑️ [UserService] Deleting user ID:", id);

    const response = await fetch(
      `${API_BASE}/deleteUser/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      let message = "Failed to delete user";

      try {
        const data = JSON.parse(text);
        message = data.message || message;
      } catch (e) {
        // Fallback for non-JSON errors (like 404 HTML)
        message = text.length > 0 ? text.slice(0, 100) : message;
      }

      console.error("❌ [UserService] Delete failed:", message);
      throw new Error(message);
    }

    console.log("✅ [UserService] User deleted successfully");
  }
}

export const userService = new UserService();
export default userService;
