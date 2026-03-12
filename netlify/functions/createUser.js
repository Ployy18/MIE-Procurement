import bcrypt from "bcryptjs";
import { authMiddleware } from "./utils/auth.js";
import { getUsers, saveUsers } from "./utils/googleSheets.js";

const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ message: "Method not allowed" }) };
  }

  // Only admin allowed
  if (event.user.role !== "admin") {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: "Forbidden: Admin access required" }),
    };
  }

  try {
    const { email, password, role } = JSON.parse(event.body);

    if (!email || !password || !role) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Email, password, and role are required" }),
      };
    }

    const users = await getUsers();

    // Check if user exists
    if (users.find(u => u.email === email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "User already exists" }),
      };
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create new user object
    const newUser = {
      id: Date.now().toString(),
      email,
      password_hash,
      role,
      status: "active",
      created_at: new Date().toISOString().split("T")[0],
    };

    users.push(newUser);
    await saveUsers(users);

    const { password_hash: _, ...safeUser } = newUser;
    return {
      statusCode: 201,
      body: JSON.stringify({ message: "User created successfully", user: safeUser }),
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

export const mainHandler = authMiddleware(handler);
export { mainHandler as handler };
