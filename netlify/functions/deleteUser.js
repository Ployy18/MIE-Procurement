import { authMiddleware } from "./utils/auth.js";
import { getUsers, saveUsers } from "./utils/googleSheets.js";

const handler = async (event, context) => {
  if (event.httpMethod !== "DELETE") {
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
    const { id } = JSON.parse(event.body);

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "User ID is required" }),
      };
    }

    // Prevent admin from deleting themselves
    if (id === event.user.id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "You cannot delete your own account" }),
      };
    }

    const users = await getUsers();
    const updatedUsers = users.filter(u => u.id !== id);

    if (users.length === updatedUsers.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    await saveUsers(updatedUsers);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "User deleted successfully" }),
    };
  } catch (error) {
    console.error("Error deleting user:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

export const mainHandler = authMiddleware(handler);
export { mainHandler as handler };
