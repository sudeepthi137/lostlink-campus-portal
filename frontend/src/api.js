const API_BASE_URL = "http://localhost:5000/api";

// Get the saved authentication token
function getToken() {
  return localStorage.getItem("token");
}

// Add authentication headers when a user is logged in
function getHeaders(extraHeaders = {}) {
  const token = getToken();

  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Read API responses safely
async function readResponse(response, fallbackMessage) {
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || fallbackMessage);
  }

  return result;
}

// Get all items
export async function getItems() {
  const response = await fetch(`${API_BASE_URL}/items`);
  const result = await readResponse(response, "Failed to load items");

  return result.data;
}

// Get categories
export async function getCategories() {
  const response = await fetch(`${API_BASE_URL}/categories`);
  const result = await readResponse(response, "Failed to load categories");

  return result.data;
}

// Register a new student
export async function registerUser(userData) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  return await readResponse(response, "Registration failed");
}

// Log in and save the returned token
export async function loginUser(credentials) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const result = await readResponse(response, "Login failed");

  // Support common response formats
  const token =
    result.token ||
    result.data?.token ||
    result.accessToken;

  const user =
    result.user ||
    result.data?.user;

  if (token) {
    localStorage.setItem("token", token);
  }

  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  }

  return result;
}

// Report an item (image uploads use FormData)
export async function createItem(formData) {
  const response = await fetch(`${API_BASE_URL}/items`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
  });

  const result = await readResponse(response, "Failed to report item");

  return result.data;
}

// Submit an item claim
export async function createClaim(claimData) {
  const response = await fetch(`${API_BASE_URL}/claims`, {
    method: "POST",
    headers: getHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(claimData),
  });

  return await readResponse(response, "Failed to submit claim");
}

// Log out
export function logoutUser() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
export async function getAdminUsers() {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:5000/api/admin/users", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to load users.");
  }

  return result.data;
}

export async function getClaims() {
  const response = await fetch(`${API_BASE_URL}/claims`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to load claims.");
  }

  return result.data || [];
}

export async function updateClaimStatus(claimId, status) {
  const response = await fetch(`${API_BASE_URL}/claims/${claimId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
    body: JSON.stringify({ status }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update claim.");
  }

  return result;
}

export async function getNotifications() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}/notifications`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to load notifications.");
  }

  return result.data;
}

export async function markNotificationRead(id) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_BASE_URL}/notifications/${id}/read`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to mark notification as read.");
  }

  return result;
}

export async function getMessages() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to load messages.");
  }

  return result.data;
}

export async function sendMessage(messageData) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(messageData),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to send message.");
  }

  return result.data;
}

export async function getMessageRecipients(itemId) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_BASE_URL}/messages/recipients/${itemId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to load recipients.");
  }

  return result.data;
}


// Get return records for the logged-in user
export async function getReturnRecords() {
  const response = await fetch(`${API_BASE_URL}/returns`, {
    headers: getHeaders(),
  });

  const result = await readResponse(
    response,
    "Failed to load return records."
  );

  return result.data;
}

// Confirm an item return
export async function confirmReturn(claimId, notes = "") {
  const response = await fetch(
    `${API_BASE_URL}/returns/${claimId}/confirm`,
    {
      method: "POST",
      headers: getHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ notes }),
    }
  );

  return await readResponse(
    response,
    "Failed to confirm item return."
  );
}
