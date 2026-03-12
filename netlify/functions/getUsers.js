import { authMiddleware } from "./utils/auth.js";
import { getUsers } from "./utils/googleSheets.js";

const handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Only admin allowed
  if (event.user.role !== "admin") {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ message: "Forbidden: Admin access required" }),
    };
  }

  try {
    const users = await getUsers();
    // Don't return password hashes
    const safeUsers = users.map(({ password_hash, ...u }) => u);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(safeUsers),
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};

export const mainHandler = authMiddleware(handler);
// Netlify expects export const handler
export { mainHandler as handler };
