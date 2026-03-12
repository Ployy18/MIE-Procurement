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

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "users!A1:F",
      valueInputOption: "RAW",
      requestBody: { values },
    });
    return true;
  } catch (error) {
    console.error("Error saving users to Google Sheets:", error.message);
    throw error;
  }
}
