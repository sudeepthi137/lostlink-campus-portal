import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import {
  getItems,
  getCategories,
  loginUser,
  registerUser,
  createClaim,
  getAdminUsers,
  getMessages,
  sendMessage,
  getMessageRecipients,
  API_BASE_URL,
} from "./api";
import {
  getClaims,
  updateClaimStatus,
  getNotifications,
  markNotificationRead,
  getReturnRecords,
  confirmReturn
} from "./api";

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

function getImageUrl(imagePath) {

  if (!imagePath) return "";

  if (

    imagePath.startsWith("http://") ||

    imagePath.startsWith("https://")

  ) {

    return imagePath;

  }

  const cleanPath = imagePath.replace(/\\/g, "/");

  return `http://localhost:5000${

    cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`

  }`;

}

export default function App() {

  const [page, setPage] = useState("Home");

  const [items, setItems] = useState([]);

  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);

  const [apiError, setApiError] = useState("");

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState("All");

  const [notice, setNotice] = useState("");

  const [selected, setSelected] = useState(null);

  const [claims, setClaims] = useState([]);

  const [reports, setReports] = useState([]);

const [notifications, setNotifications] = useState([]);
const [notificationsLoading, setNotificationsLoading] = useState(false);
const [messages, setMessages] = useState([]);
const [messagesLoading, setMessagesLoading] = useState(false);

const [returnRecords, setReturnRecords] = useState([]);
const [returnsLoading, setReturnsLoading] = useState(false);

const [adminUsers, setAdminUsers] = useState([]);
const [adminUsersLoading, setAdminUsersLoading] = useState(false);

const [user, setUser] = useState(() => {
  try {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
});
const [selectedMessageItemId, setSelectedMessageItemId] = useState(null);

  const [auth, setAuth] = useState({

    full_name: "",

    email: "",

    password: "",

    department: ""

  });

  const [form, setForm] = useState({

    item_name: "",

    category_name: "",

    item_type: "Lost",

    location: "",

    item_date: "",

    description: "",

    image_path: ""

  });

  const [proof, setProof] = useState("");

  const [reportReason, setReportReason] = useState("");

  const [selectedImage, setSelectedImage] = useState(null);

  const [imagePreview, setImagePreview] = useState("");
  
const loadNotifications = async () => {
  setNotificationsLoading(true);

  try {
    const data = await getNotifications();
    setNotifications(Array.isArray(data) ? data : []);
  } catch (error) {
    setNotice(error.message || "Could not load notifications.");
  } finally {
    setNotificationsLoading(false);
  }
};
const loadMessages = async () => {
  setMessagesLoading(true);

  try {
    const data = await getMessages();
    setMessages(Array.isArray(data) ? data : []);
  } catch (error) {
    setNotice(error.message || "Could not load messages.");
  } finally {
    setMessagesLoading(false);
  }
};
const loadClaims = async () => {
  try {
    const data = await getClaims();
    setClaims(Array.isArray(data) ? data : []);
  } catch (error) {
    setNotice(error.message || "Could not load claims.");
  }
};

// Load return records
const loadReturnRecords = async () => {
  try {
    setReturnsLoading(true);

    const data = await getReturnRecords();
    setReturnRecords(data || []);
  } catch (error) {
    setNotice(error.message || "Failed to load return records.");
  } finally {
    setReturnsLoading(false);
  }
};

// Confirm that an item has been returned



const handleConfirmReturn = async (claimId) => {
  try {
    const result = await confirmReturn(claimId);

    setNotice(result.message || "Return confirmation saved.");

    await loadReturnRecords();
    await loadClaims();
  } catch (error) {
    setNotice(error.message || "Could not confirm return.");
  }
};

const handleSendMessage = async (messageData) => {
  try {
    await sendMessage(messageData);
    await loadMessages();
    setNotice("Message sent successfully.");
  } catch (error) {
    setNotice(error.message || "Could not send message.");
  }
};
useEffect(() => {
  if (user) {
    loadMessages();
    loadClaims();
    loadReturnRecords();
  } else {
    setClaims([]);
    setReturnRecords([]);
  }
}, [user]);

useEffect(() => {
  if (user) {
    loadNotifications();
  }
}, [user]);


  // Load actual items and categories from the backend

  useEffect(() => {

    async function loadData() {

      try {

        setLoading(true);

        setApiError("");

        const [itemsData, categoriesData] = await Promise.all([

          getItems(),

          getCategories()

        ]);

        const categoryList = categoriesData.map(category => ({

          ...category,

          category_id: Number(category.category_id)

        }));

        setCategories(categoryList);

        setItems(itemsData.map(item => {

          const category = categoryList.find(

            c => c.category_id === Number(item.category_id)

          );

          return {

            ...item,

            item_type: String(item.item_type || "lost")

              .toLowerCase() === "found" ? "Found" : "Lost",

            category_name:

              item.category_name ||

              category?.category_name ||

              "Other",

            item_date: item.item_date

              ? String(item.item_date).slice(0, 10)

              : "",

            status: item.status || "open"

          };

        }));

        setForm(previous => ({

          ...previous,

          category_name: categoryList[0]?.category_name || ""

        }));

      } catch (error) {

        console.error("Failed to load LostLink data:", error);

        setApiError(

          "Could not load items. Please check that the backend and MySQL are running."

        );

      } finally {

        setLoading(false);

      }

    }

    loadData();

  }, []);

  function updateForm(e) {

    setForm({ ...form, [e.target.name]: e.target.value });

  }

  function handleImageChange(e) {

    const file = e.target.files?.[0] || null;

    if (!file) {

      setSelectedImage(null);

      setImagePreview("");

      return;

    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    if (!allowedTypes.includes(file.type)) {

      setNotice("Please choose a JPG, PNG, WEBP or GIF image.");

      e.target.value = "";

      setSelectedImage(null);

      setImagePreview("");

      return;

    }

    if (file.size > 5 * 1024 * 1024)  {

      setNotice("Image must be 5 MB or smaller.");

      e.target.value = "";

      setSelectedImage(null);

      setImagePreview("");

      return;

    }

    setNotice("");

    setSelectedImage(file);

    setImagePreview(URL.createObjectURL(file));

  }

  // Save the report and optional image through Express/Multer

 
async function addItem(e) {
  e.preventDefault();
  setNotice("");

  if (!user?.user_id) {
    setNotice("Please log in before reporting an item.");
    setPage("Login");
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    setNotice("Your login session has expired. Please log in again.");
    setPage("Login");
    return;
  }

  const category = categories.find(
    c => c.category_name === form.category_name
  );

  if (!category) {
    setNotice("Please select a valid category.");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("category_id", String(category.category_id));
    formData.append("item_name", form.item_name.trim());
    formData.append("description", form.description.trim());
    formData.append("item_type", form.item_type.toLowerCase());
    formData.append("location", form.location.trim());
    formData.append("item_date", form.item_date || "");

    if (selectedImage) {
      formData.append("image", selectedImage);
    } else if (form.image_path?.trim()) {
      formData.append("image_path", form.image_path.trim());
    }

    const response = await fetch(`${API_ORIGIN}/api/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to save item.");
    }

    const itemsData = await getItems();

    setItems(itemsData.map(item => {
      const matchedCategory = categories.find(
        c => Number(c.category_id) === Number(item.category_id)
      );

      return {
        ...item,
        item_type:
          String(item.item_type || "lost").toLowerCase() === "found"
            ? "Found"
            : "Lost",
        category_name:
          item.category_name || matchedCategory?.category_name || "Other",
        item_date: item.item_date
          ? String(item.item_date).slice(0, 10)
          : "",
        status: item.status || "open"
      };
    }));

    setForm({
      item_name: "",
      category_name: categories[0]?.category_name || "",
      item_type: "Lost",
      location: "",
      item_date: "",
      description: "",
      image_path: ""
    });

    setSelectedImage(null);
    setImagePreview("");
    setNotice("Your item post has been added!");
    setPage("Browse");
  } catch (error) {
    console.error("Failed to save item:", error);
    setNotice(error.message || "Could not save item. Please try again.");
  }
}


  // Demo login only; real authentication will be added separately



async function login(e) {
  e.preventDefault();

  const isRegistering = Boolean(auth.full_name.trim());

  try {
    const result = isRegistering
      ? await registerUser({
          full_name: auth.full_name.trim(),
          email: auth.email.trim(),
          password: auth.password,
          department: auth.department.trim(),
        })
      : await loginUser({
          email: auth.email.trim(),
          password: auth.password,
        });

    localStorage.setItem("user", JSON.stringify(result.user));

    if (result.token) {
      localStorage.setItem("token", result.token);
    }

    setUser(result.user);
    setNotice(
      result.message ||
        (isRegistering ? "Registration successful." : "Login successful.")
    );
    setPage("Home");
  } catch (error) {
    setNotice(error.message || "Authentication failed.");
  }
}


async function submitClaim(e) {

  e.preventDefault();

  if (!user?.user_id) {

    setNotice("Please log in before submitting a claim.");

    return;

  }

  if (!selected?.item_id || !proof.trim()) {

    setNotice("Please provide the required claim details.");

    return;

  }

  try {

    const result = await createClaim({

      item_id: selected.item_id,

      claimant_id: user.user_id,

      proof_details: proof.trim()

    });

    setClaims((previousClaims) => [

      {

        claim_id: result.data.claim_id,

        item_id: selected.item_id,

        item_name: selected.item_name,

        proof_details: proof.trim(),

        status: "Pending"

      },

      ...previousClaims

    ]);

    setProof("");

    setNotice(result.message || "Your claim has been submitted for review.");

    setSelected(null);

    setPage("My Claims");

  } catch (error) {

    setNotice(error.message || "Failed to submit claim.");

  }

}

  
async function submitReport(e) {
  e.preventDefault();

  if (!selected || !reportReason.trim()) {
    setNotice("Please select an item and enter a reason.");
    return;
  }

  const token = localStorage.getItem("token");

  if (!token) {
    setNotice("Please log in again before submitting a report.");
    setPage("Login");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        item_id: selected.item_id,
        reason: reportReason.trim(),
        details: reportReason.trim(),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to save report.");
    }

    setReports((previous) => [result.data, ...previous]);
    setReportReason("");
    setNotice("Report saved successfully for admin review.");
    setSelected(null);
    setPage("Browse");
  } catch (error) {
    console.error("Report submission error:", error);
    setNotice(error.message || "Could not save report.");
  }
}

  const filteredItems = items.filter(item => {

    const text = `${item.item_name} ${item.location} ${item.category_name} ${item.description || ""}`.toLowerCase();

    return text.includes(search.toLowerCase()) &&

      (filter === "All" || item.item_type === filter);

  });


const menu = [
  "Home",
  "Browse Items",
  "Report Item",
  "My Claims",
  "My Returns",
  "Messages",
  "Notifications",
  "My Account",
  ...(String(user?.role || "").toLowerCase() === "admin"
    ? ["Admin Dashboard"]
    : [])
];

  return (

    <div className="app">

      <header className="topbar">

        <div className="brand" onClick={() => setPage("Home")}>

          <span className="brand-icon">🔎</span>

          <div>

            <h2>LostLink</h2>

            <small>Campus Lost & Found</small>

          </div>

        </div>

        <div className="user-area">

          <span>{user ? `Hi, ${user.full_name}` : "Student Portal"}</span>

          {user ? (

            <button
onClick={() => {
  setUser(null);
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  setNotice("Logged out.");
  setPage("Home");
}}

            >

              Logout

            </button>

          ) : (

            <button onClick={() => setPage("Login")}>

              Login / Register

            </button>

          )}

        </div>

      </header>

      <div className="layout">

        <aside className="sidebar">

          <p className="nav-label">MENU</p>

          {menu.map(item => (
            <button
              key={item}
              className={
                page === item ||
                (page === "Browse" && item === "Browse Items")
                  ? "nav active"
                  : "nav"
              }
              onClick={() => {

                setPage(item === "Browse Items" ? "Browse" : item);

                setNotice("");

              }}

            >

              {({

                "Home": "⌂",

                "Browse Items": "⌕",

                "Report Item": "+",

                "My Claims": "◇",
                "My Returns": "↩",

                "Messages": "✉",

                "Notifications": "♧",

                "My Account": "♙",
                "Admin Dashboard": "⚙️"

              })[item]}

              <span>{item}</span>

              {item === "Notifications" && (
  <b className="count">
    {notifications.filter((n) => Number(n.is_read) !== 1).length}
  </b>
)}
</button>
          ))}

          <div className="sidebar-note">

            <span>💡</span>

            <b>Help your campus</b>

            <p>Every returned item makes someone's day better.</p>

          </div>

        </aside>

        <main className="content">

          {notice && (

            <div className="notice">

              {notice}

              <button onClick={() => setNotice("")}>×</button>

            </div>

          )}

          {page === "Home" && <>
            <section className="hero">
              <div>
                <span className="eyebrow">YOUR CAMPUS, CONNECTED</span>
                <h1>Lost something?<br />Let's find it together.</h1>
                <p>A simple and safe way to report, discover and recover belongings on campus.</p>
                <button onClick={() => setPage("Browse")}>Explore Items →</button>
                <button className="light-button" onClick={() => setPage("Report Item")}>+ Report an Item</button>
              </div>
              <div className="hero-art">🎒<span>🔑</span><span>📚</span></div>
            </section>
            <div className="section-heading">
              <div>
                <h2>Campus Overview</h2>
                <p>Here's what's happening on campus.</p>
              </div>
            </div>
            <div className="stats">
              <div className="stat">
                <span>🔍</span><p>Total Posts</p><h2>{items.length}</h2>
              </div>
              <div className="stat">
                <span>🧭</span><p>Lost Items</p>
                <h2>{items.filter(i => i.item_type === "Lost").length}</h2>
              </div>
              <div className="stat">
                <span>🎁</span><p>Found Items</p>
                <h2>{items.filter(i => i.item_type === "Found").length}</h2>
              </div>
              <div className="stat">
                <span>🤝</span><p>My Claims</p><h2>{claims.length}</h2>
              </div>
            </div>
            <div className="section-heading">
              <div>
                <h2>Recently Posted</h2>
                <p>Latest items reported by students.</p>
              </div>
              <button className="outline" onClick={() => setPage("Browse")}>View All →</button>
            </div>
            {loading ? <p>Loading campus items...</p> : (
              <ItemGrid
                items={items.slice(0, 3)}
                onSelect={item => {
                  setSelected(item);
                  setPage("Details");
                }}
              />
            )}
            {apiError && <p role="alert">{apiError}</p>}
          </>}
          {page === "Browse" && <>
            <div className="page-heading">
              <h1>Browse Items</h1>
              <p>Search lost and found items across your campus.</p>
            </div>
            <div className="filters">
              <input
                placeholder="🔍 Search item, category or location..."
                value={search} 
                onChange={e => setSearch(e.target.value)}
              />
              <select value={filter} onChange={e => setFilter(e.target.value)}>
                <option>All</option>
                <option>Lost</option>
                <option>Found</option>
              </select>
            </div>
            {apiError && <p role="alert">{apiError}</p>}
            {loading ? <p>Loading campus items...</p> : <>
              <p className="result-count">{filteredItems.length} items found</p>
              <ItemGrid
                items={filteredItems}
                onSelect={item => {
                  setSelected(item);
                  setPage("Details");
                }}
              />
            </>}
          </>}
          {page === "Report Item" && <>
            <div className="page-heading">
              <h1>Report an Item</h1>
              <p>Give enough details to help someone find their belongings.</p>
            </div>
            <form className="panel form-grid" onSubmit={addItem}>
              <label>
                Item Name \*
                <input required name="item_name" value={form.item_name} onChange={updateForm} placeholder="e.g. Black backpack" />
              </label>
              <label>
                Item Type \*
                <select name="item_type" value={form.item_type} onChange={updateForm}>
                  <option>Lost</option>
                  <option>Found</option>
                </select>
              </label>
              <label>
                Category \*
                <select required name="category_name" value={form.category_name} onChange={updateForm}>
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_name}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Location \*
                <input required name="location" value={form.location} onChange={updateForm} placeholder="e.g. Library, Block A" />
              </label>
              <label>
                Date \*
                <input required type="date" name="item_date" value={form.item_date} onChange={updateForm} />
              </label>
              <label>
                Item Photo (optional, JPG/PNG/WEBP/GIF; max 5 MB)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageChange}
                />
              </label>
              {imagePreview && (
                <div className="full image-preview">
                  <p>Photo preview</p>
                  <img
                    src={imagePreview}
                    alt="Selected item preview"
                    style={{ maxWidth: "100%", maxHeight: "240px", objectFit: "contain", borderRadius: "10px" }}
                  />
                  <button
                    type="button"
                    className="outline"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview("");
                    }}
                  >
                    Remove photo
                  </button>
                </div>
              )}
              <label className="full">
                Description \*
                <textarea required name="description" value={form.description} onChange={updateForm} placeholder="Describe the item, colour, identifying features..." rows="4" />
              </label>
              <p className="full helper">
                Please don't include passwords, private ID numbers or other sensitive information.
              </p>
              <button className="full" type="submit">Submit Item Post</button>
            </form>
          </>}
          {page === "Details" && selected && <>
            <button className="back" onClick={() => setPage("Browse")}>← Back to items</button>
            <div className="panel details">
              <div className="detail-art">
                {selected.image_path ? <img src={getImageUrl(selected.image_path)} alt={selected.item_name} /> : "📦"}
              </div>
              <span className={`tag ${selected.item_type.toLowerCase()}`}>{selected.item_type}</span>
              <h1>{selected.item_name}</h1>
              <p>{selected.description}</p>
              <p>📂 Category: {selected.category_name || "Other"}</p>
              <p>📍 Location: {selected.location}</p>
              <p>📅 Date: {selected.item_date}</p>
              <p>Current status: <b>{selected.status}</b></p>
              <button onClick={() => {
                if (!user) {
                  setNotice("Login first to submit a claim.");
                  setPage("Login");
                } else {
                  setPage("Claim");
                }
              }}>Claim This Item</button>
              <button className="outline" onClick={() => {
                setReportReason("");
                setPage("Report Post");
              }}>Report Post</button>
            </div>
          </>}
          {page === "Claim" && selected && <>

            <div className="page-heading">
          
              <h1>Claim Item</h1>
              <p>Explain how you can verify that this item belongs to you.</p>
            </div>
            <form className="panel" onSubmit={submitClaim}>
              <h3>{selected.item_name}</h3>
              <label>
                Proof of Ownership \*
                <textarea required rows="5" value={proof} onChange={e => setProof(e.target.value)} placeholder="Describe unique features or details only the owner would know." />
              </label>
              <p className="helper">Do not share passwords or sensitive personal information.</p>
              <button>Submit Claim</button>
            </form>
          </>}
          {page === "Report Post" && selected && <>
            <div className="page-heading">
              <h1>Report a Post</h1>
              <p>Tell the admin why this post needs review.</p>
            </div>
            <form className="panel" onSubmit={submitReport}>
              <h3>{selected.item_name}</h3>
              <label>
                Reason \*
                <textarea required rows="4" value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Explain the issue with this post." />
              </label>
              <button>Submit Report</button>
            </form>
          </>}
          {page === "My Claims" && (
  <>
    <div className="page-heading">
      <h1>My Claims</h1>
      <p>Track the items you've claimed.</p>
    </div>

    {claims.length ? claims.map((c) => {
      const currentUserId = Number(user?.user_id);
      const isOwner = currentUserId === Number(c.owner_id);
      const isClaimant = currentUserId === Number(c.claimant_id);

      const record = returnRecords.find(
        (r) => Number(r.claim_id) === Number(c.claim_id)
      );

      const confirmed = record && (
        (isOwner && Number(record.owner_confirmed) === 1) ||
        (isClaimant && Number(record.finder_confirmed) === 1)
      );

      return (
        <div className="panel list-row" key={c.claim_id}>
          <div>
            <h3>{c.item_name}</h3>
            <p>Claim ID: {c.claim_id}</p>
            <p>Status: {c.status}</p>
          </div>

          <div>
            <span className="tag pending">{c.status}</span>

            {c.status === "approved" &&
              (isOwner || isClaimant) && (
                <button
                  disabled={!!confirmed}
                  onClick={() => handleConfirmReturn(c.claim_id)}
                >
                  {confirmed ? "Confirmed ✓" : "Confirm Return"}
                </button>
              )}
          </div>
        </div>
      );
    }) : <Empty text="You haven't submitted any claims yet." />}
  </>
)}
{page === "My Returns" && (
  <>
    <div className="page-heading">
      <h1>My Returns ↩</h1>
      <p>Track returned belongings and confirmation status.</p>
    </div>

    <button
      onClick={loadReturnRecords}
      disabled={returnsLoading}
    >
      {returnsLoading ? "Loading..." : "Refresh Returns"}
    </button>

    {returnsLoading ? (
      <Empty text="Loading return records..." />
    ) : returnRecords.length === 0 ? (
      <Empty text="No return records found yet." />
    ) : (
      returnRecords.map((record) => (
        <div className="panel" key={record.return_id}>
          <h3>{record.item_name}</h3>

          <p>Owner: {record.owner_name}</p>
          <p>Finder: {record.finder_name}</p>

          <p>
            Owner confirmation:{" "}
            {Number(record.owner_confirmed) === 1
              ? "Confirmed"
              : "Pending"}
          </p>

          <p>
            Finder confirmation:{" "}
            {Number(record.finder_confirmed) === 1
              ? "Confirmed"
              : "Pending"}
          </p>

          <p>Claim status: {record.claim_status || "completed"}</p>

          <p>
            Returned on:{" "}
            {record.returned_at
              ? new Date(record.returned_at).toLocaleString()
              : "Not available"}
          </p>
        </div>
      ))
    )}
  </>
)}          

{page === "Messages" && (
<MessagesPage
  user={user}
  items={items}
  messages={messages}
  messagesLoading={messagesLoading}
  onSendMessage={handleSendMessage}
  onRefresh={loadMessages}
  selectedItemId={selectedMessageItemId}
/>
)}

          

          {page === "Notifications" && (
            <>
              <div className="page-heading">
                <h1>Notifications</h1>
                <p>Updates about your activity.</p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                <button
                  className="btn"
                  onClick={loadNotifications}
                  disabled={notificationsLoading}
                >
                  {notificationsLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {notificationsLoading ? (
                <Empty text="Loading notifications..." />
              ) : notifications.length === 0 ? (
                <Empty text="You have no notifications yet." />
              ) : (
                <div>
                  {notifications.map((n) => (
                    <div
                      className="panel notification"
                      key={n.notification_id}
                      style={{
                        marginBottom: "12px",
                        background: Number(n.is_read) === 1 ? "#fff" : "#f0f4ff"
                      }}
                    >
                      <span>🔔</span>

                      <div style={{ flex: 1 }}>
                        <h3>{n.title}</h3>
                        <p>{n.message}</p>
                        <small>
                          {n.created_at
                            ? new Date(n.created_at).toLocaleString()
                            : ""}
                          {Number(n.is_read) === 1 ? " · Read" : " · Unread"}
                        </small>
                      </div>

<button
  className="btn"
 onClick={async () => {
  setSelectedMessageItemId(n.item_id);
  setPage("Messages");

  if (Number(n.is_read) !== 1) {
    try {
      await markNotificationRead(n.notification_id);
      await loadNotifications();
    } catch (error) {
      console.error("Could not mark notification as read:", error);
    }
  }
}}
>
  Open Messages
</button>
                      {Number(n.is_read) !== 1 && (
                        <button
                          className="btn"
                          onClick={async () => {
                            try {
                              await markNotificationRead(n.notification_id);
                              await loadNotifications();
                              setNotice("Notification marked as read.");
                            } catch (error) {
                              setNotice(
                                error.message || "Could not update notification."
                              );
                            }
                          }}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {page === "My Account" && (
            <>
              <div className="page-heading">
                <h1>My Account</h1>
                <p>Your student profile.</p>
              </div>

              <div className="panel">
                <div className="avatar">♙</div>
                <h2>{user?.full_name || "Guest Student"}</h2>
                <p>{user?.email || "Not logged in"}</p>
                <p>Department: {user?.department || "Not provided"}</p>
                <p>Role: {user?.role || "Guest"}</p>

                {!user && (
                  <button onClick={() => setPage("Login")}>
                    Login / Register
                  </button>
                )}
              </div>
            </>
          )}

      {page === "Admin Dashboard" && (
  <div className="page-heading">
    <h1>Admin Dashboard</h1>
    <p>Manage LostLink campus activity.</p>

    <div className="stats-grid">
      <div className="panel">
        <h3>Manage Users</h3>
        <p>View and manage registered users.</p>
        <button
  onClick={() => {
  setPage("Admin Users");
  setNotice("");
}}
  disabled={adminUsersLoading}
>
  {adminUsersLoading ? "Loading..." : "View Users"}
</button>
      </div>

      <div className="panel">
        <h3>Manage Items</h3>
       <button onClick={() => setPage("Browse")}>
  Browse Items
</button>
      </div>
     

      <div className="panel">
        <h3>Manage Claims</h3>
        <p>Check claims submitted by students.</p>
       <button onClick={() => setPage("Admin Claims")}>
  View Claims
</button>
      </div>
    </div>
  </div>
)}


{page === "Admin Users" && (
  <>
    <div className="page-heading">
      <h1>Manage Users</h1>
      <p>View registered users on LostLink.</p>
    </div>

    <div className="panel">
      <h3>Registered Users</h3>

      <button
        onClick={async () => {
          try {
            setAdminUsersLoading(true);
            const users = await getAdminUsers();
            setAdminUsers(users);
            setNotice(`Loaded ${users.length} users.`);
          } catch (error) {
            setNotice(error.message || "Could not load users.");
          } finally {
            setAdminUsersLoading(false);
          }
        }}
        disabled={adminUsersLoading}
      >
        {adminUsersLoading ? "Loading..." : "Refresh Users"}
      </button>

      {adminUsers.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((u, index) => (
                <tr key={u.user_id}>
                  <td>{index + 1}</td>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{u.department || "—"}</td>
                  <td>{u.role || "student"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No users loaded yet. Click Refresh Users.</p>
      )}

      <button onClick={() => setPage("Admin Dashboard")}>
        Back to Admin Dashboard
      </button>
    </div>
  </>
)}
{page === "Admin Claims" && (
  <AdminClaimsPage
    onBack={() => setPage("Admin Dashboard")}
    getClaims={getClaims}
    updateClaimStatus={updateClaimStatus}
    setNotice={setNotice}
  />
)}
          {page === "Login" && <>

            <div className="page-heading">

              <h1>Welcome to LostLink</h1>

              <p>Sign in or create a demo student profile.</p>

            </div>

            <form className="panel auth-form" onSubmit={login}>

              <label>

                Full Name (for registration)

                <input value={auth.full_name} onChange={e => setAuth({ ...auth, full_name: e.target.value })} placeholder="Your full name" />

              </label>

              <label>

                Email \*

                <input required type="email" value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })} placeholder="student@college.edu" />

              </label>

              <label>

                Password \*

                <input required type="password" value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} placeholder="Enter password" />

              </label>

              <label>

                Department

                <input value={auth.department} onChange={e => setAuth({ ...auth, department: e.target.value })} placeholder="e.g. CSE" />

              </label>

              <button>Continue</button>

<p className="helper">
  Enter your name and department to register a new account.
  Leave the name empty to log in with an existing account.
</p>
            </form>

          </>}

          <footer>© 2026 LostLink · Helping campus belongings find their way home.</footer>

        </main>

      </div>

    </div>

  );

}

function ItemGrid({ items, onSelect }) {

  if (!items.length) return <Empty text="No items match your search." />;

  return (

    <div className="item-grid">

      {items.map(item => (

        <article className="item-card" key={item.item_id}>

          <div className="item-image">

            {item.image_path ? (

  <img

    src={getImageUrl(item.image_path)}

    alt={item.item_name}

    onError={(e) => {

      e.currentTarget.style.display = "none";

    }}

  />

) : (

  <span className="item-placeholder">📦</span>

)}

            <span className={`tag ${item.item_type.toLowerCase()}`}>{item.item_type}</span>

          </div>

          <div className="item-info">

            <small>{item.category_name || "Other"}</small>

            <h3>{item.item_name}</h3>

            <p>📍 {item.location}</p>

            <p>📅 {item.item_date}</p>

            <p className="description">{item.description}</p>

            <button onClick={() => onSelect(item)}>View Details →</button>

          </div>

        </article>

      ))}

    </div>

  );

}

function Empty({ text }) {

  return <div className="panel empty"><span>📭</span><p>{text}</p></div>;

}

function AdminClaimsPage({ onBack, getClaims, updateClaimStatus, setNotice }) {
  const [claims, setClaims] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    getClaims()
      .then(setClaims)
      .catch((err) => setError(err.message || "Could not load claims."))
      .finally(() => setLoading(false));
  }, [getClaims]);

  async function changeStatus(claimId, status) {
    try {
      await updateClaimStatus(claimId, status);
      setClaims((previous) =>
        previous.map((claim) =>
          claim.claim_id === claimId ? { ...claim, status } : claim
        )
      );
      setNotice(`Claim #${claimId} marked ${status}.`);
    } catch (err) {
      setError(err.message || "Could not update claim.");
    }
  }

  return (
    <>
      <div className="page-heading">
        <h1>Manage Claims</h1>
        <p>Review claims submitted by students.</p>
      </div>

      <div className="panel">
        <h3>Claims Management</h3>

        {loading && <p>Loading claims...</p>}
        {error && <p role="alert">{error}</p>}

        {!loading && !error && claims.length === 0 && (
          <p>No claims have been submitted yet.</p>
        )}

        {!loading && claims.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Item</th>
                  <th>Claimant</th>
                  <th>Proof details</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.claim_id}>
                    <td>{claim.claim_id}</td>
                    <td>{claim.item_name}</td>
                    <td>{claim.claimant_name}</td>
                    <td>{claim.proof_details}</td>
                    <td>
                      {claim.created_at
                        ? new Date(claim.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>{claim.status}</td>
                    <td>
                      {claim.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              changeStatus(claim.claim_id, "approved")
                            }
                          >
                            Approve
                          </button>{" "}
                          <button
                            onClick={() =>
                              changeStatus(claim.claim_id, "rejected")
                            }
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={onBack}>Back to Admin Dashboard</button>
      </div>
    </>
  );
}
function MessagesPage({
  user,
  items,
  messages,
  messagesLoading,
  onSendMessage,
  onRefresh,
  selectedItemId,
}) {
  const [itemId, setItemId] = useState(
    selectedItemId ? String(selectedItemId) : ""
  );

  useEffect(() => {
  if (selectedItemId != null) {
    setItemId(String(selectedItemId));
    setRecipientId("");
    setRecipients([]);
  }
}, [selectedItemId]);

useEffect(() => {
  if (selectedItemId != null) {
    setItemId(String(selectedItemId));
    setRecipientId("");
    setRecipients([]);
  }
}, [selectedItemId]);
  useEffect(() => {
  if (selectedItemId) {
    setItemId(String(selectedItemId));
  }
}, [selectedItemId]);
  const [recipientId, setRecipientId] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [messageText, setMessageText] = useState("");

  // Keep the rest of your existing function below this point.

  const myId = Number(user?.user_id ?? user?.id);
useEffect(() => {
  if (!itemId) {
    setRecipients([]);
    setRecipientId("");
    return;
  }

  let cancelled = false;

  async function loadRecipients() {
    try {
      const data = await getMessageRecipients(itemId);

      if (!cancelled) {
        setRecipients(Array.isArray(data) ? data : []);
        setRecipientId("");
      }
    } catch (error) {
      if (!cancelled) {
        setRecipients([]);
        setRecipientId("");
        console.error("Failed to load recipients:", error);
      }
    }
  }

  loadRecipients();

  return () => {
    cancelled = true;
  };
}, [itemId]);
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!itemId || !recipientId || !messageText.trim()) {
      alert("Please select an item, enter the recipient ID, and type a message.");
      return;
    }

    try {
      await onSendMessage({
        item_id: Number(itemId),
        recipient_id: Number(recipientId),
        message_text: messageText.trim(),
      });

      setMessageText("");
      await onRefresh();
    } catch (error) {
      alert(error.message || "Could not send message.");
    }
  };

  return (
    <div>
      <div className="page-heading">
        <h1>Messages</h1>
        <p>Communication about claimed items.</p>
      </div>

      <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
        <h2>Send a Message</h2>

        <form onSubmit={handleSubmit}>
          <label>
            Item
           <select
  value={itemId}
  required
  onChange={async (e) => {
    const selectedItemId = e.target.value;
    setItemId(selectedItemId);
    setRecipientId("");
    setRecipients([]);

    if (!selectedItemId) return;

    try {
      const people = await getMessageRecipients(selectedItemId);
      setRecipients(people);

      if (people.length === 1) {
        setRecipientId(String(people[0].user_id));
      }
    } catch (error) {
      alert(error.message || "Could not load recipients.");
    }
  }}
>
  <option value="">Select an item</option>
  {items.map((item) => (
    <option key={item.item_id} value={item.item_id}>
      {item.item_name} (ID: {item.item_id})
    </option>
  ))}
</select>
 </label>

        
<label>
  Recipient
  <select
    value={recipientId}
    onChange={(e) => setRecipientId(e.target.value)}
    required
    disabled={!recipients.length}
  >
    <option value="">Select a recipient</option>
    {recipients.map((person) => (
      <option key={person.user_id} value={person.user_id}>
        {person.full_name}
      </option>
    ))}
  </select>
</label>


          <label>
            Message
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows="3"
              maxLength="2000"
              required
              placeholder="Write your message..."
            />
          </label>

          <button className="btn" type="submit">
            Send Message
          </button>
          <button
            className="btn"
            type="button"
            onClick={onRefresh}
            style={{ marginLeft: 8 }}
          >
            Refresh
          </button>
        </form>
      </div>

      <div className="page-heading">
        <h2>Your Conversations</h2>
      </div>

      {messagesLoading ? (
        <p>Loading messages...</p>
      ) : messages.length === 0 ? (
        <div className="panel empty-state">
          <p>You have no messages yet.</p>
        </div>
      ) : (
        messages.map((message) => (
          <div className="panel" key={message.message_id} style={{ marginBottom: 12, padding: 16 }}>
            <h3>{message.item_name || `Item #${message.item_id}`}</h3>
            <p>
              <strong>From:</strong> {message.sender_name || message.sender_id}
              {" · "}
              <strong>To:</strong> {message.recipient_name || message.recipient_id}
            </p>
            <p>{message.message_text}</p>
            <small>
              {message.created_at
                ? new Date(message.created_at).toLocaleString()
                : ""}
            </small>
          </div>
        ))
      )}
    </div>
  );
}
