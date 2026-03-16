import { sheets, SPREADSHEET_ID } from "../shared.js";

export async function getUsers() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "users!A1:Z",
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const user = {};
      headers.forEach((header, index) => {
        user[header] = row[index];
      });
      return user;
    });

    return data;
  } catch (error) {
    console.error("Error fetching users from Google Sheets:", error.message);
    // If sheet doesn't exist, return empty array to allow first login/setup
    if (error.message.includes("range") || error.message.includes("not found")) {
      return [];
    }
    throw error;
  }
}

export async function saveUsers(users) {
  try {
    console.log(`💾 [GoogleSheets] Saving ${users.length} users...`);
    const headers = ["id", "email", "password_hash", "role", "status", "created_at"];
    const values = [
      headers,
      ...users.map((u) => [
        u.id,
        u.email,
        u.password_hash,
        u.role || "user",
        u.status || "active",
        u.created_at || new Date().toISOString().split("T")[0],
      ]),
    ];

    // Clear the existing range first to prevent stale data when user count decreases
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: "users!A:F",
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "users!A1",
      valueInputOption: "RAW",
      requestBody: { values },
    });
    
    console.log("✅ [GoogleSheets] Users saved successfully");
    return true;
  } catch (error) {
    console.error("❌ [GoogleSheets] Error saving users:", error.message);
    throw error;
  }
}
