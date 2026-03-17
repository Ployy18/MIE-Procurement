import { authMiddleware } from "./utils/auth.js";
import { getUsers, saveUsers } from "./utils/googleSheets.js";

const handler = async (event, context) => {
  if (event.httpMethod !== "PUT") {
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
    const { id, email, role, status } = JSON.parse(event.body);

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "User ID is required" }),
      };
    }

    const users = await getUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    // Update fields
    if (email) users[userIndex].email = email;
    if (role) users[userIndex].role = role;
    if (status) users[userIndex].status = status;

    await saveUsers(users);

    const { password_hash: _, ...safeUser } = users[userIndex];
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "User updated successfully", user: safeUser }),
    };
  } catch (error) {
    console.error("Error updating user:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};

export const mainHandler = authMiddleware(handler);
export { mainHandler as handler };
