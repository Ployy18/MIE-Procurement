import bcrypt from "bcryptjs";
import { getUsers } from "./utils/googleSheets.js";
import { generateToken } from "./utils/auth.js";

export const handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ message: "OK" }) 
    };
  }

  // Only POST allowed
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ message: "Method not allowed. Use POST." }) 
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Request body is empty" }),
      };
    }

    const { email, password } = JSON.parse(event.body);
    console.log("🔍 [Login] Attempt for:", email);

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Email and password are required" }),
      };
    }

    // Fetch users from Google Sheets
    const users = await getUsers();
    const user = users.find((u) => u.email === email);

    if (!user) {
      console.warn("⚠️ [Login] User not found:", email);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid email or password" }),
      };
    }

    // Check status
    if (user.status !== "active") {
      console.warn("⚠️ [Login] Suspended account attempt:", email);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Account is suspended" }),
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      console.warn("❌ [Login] Invalid password for:", email);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid email or password" }),
      };
    }

    // Generate JWT
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    console.log("✅ [Login] Success for:", email);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      }),
    };
  } catch (error) {
    console.error("🔥 [Login] Fatal error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Internal server error",
        error: error.message 
      }),
    };
  }
};
