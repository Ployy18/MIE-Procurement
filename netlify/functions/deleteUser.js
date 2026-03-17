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
    // Robust ID Extraction: Try path parameters, query parameters, or manual path parsing
    let id = event.pathParameters?.id || event.queryStringParameters?.id;

    if (!id && event.path) {
      const pathSegments = event.path.split("/").filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment && lastSegment !== "deleteUser") {
        id = lastSegment;
      }
    }

    // Fallback to body
    if (!id && event.body) {
      try {
        const body = JSON.parse(event.body);
        id = body.id;
      } catch {}
    }

    if (!id) {
      console.error("❌ [DeleteUser] ID Missing in event:", {
        path: event.path,
        pathParameters: event.pathParameters,
        query: event.queryStringParameters,
      });
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "User ID is required" }),
      };
    }

    // Safeguard 1: Prevent deleting self
    if (String(id).trim() === String(event.user.id).trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "You cannot delete your own account" }),
      };
    }

    const users = await getUsers();
    console.log(`👥 [DeleteUser] Users before: ${users.length}`);

    // Safeguard 2: Prevent deleting the last admin
    if (users.filter(u => u.role === "admin" && u.status === "active").length <= 1) {
      const targetUser = users.find(u => String(u.id).trim() === String(id).trim());
      if (targetUser && targetUser.role === "admin") {
         return {
          statusCode: 400,
          body: JSON.stringify({ message: "Cannot delete the last active administrator" }),
        };
      }
    }

    const updatedUsers = users.filter(u => String(u.id).trim() !== String(id).trim());
    console.log(`👥 [DeleteUser] Users after filter: ${updatedUsers.length}`);

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
