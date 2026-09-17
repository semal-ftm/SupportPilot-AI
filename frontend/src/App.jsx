import { useEffect, useState } from "react";
import axios from "axios";
import "./index.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);

  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I'm SupportPilot AI. How can I help you today?",
      tools: [],
    },
  ]);

  const [loading, setLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ordersResponse, ticketsResponse] = await Promise.all([
        axios.get(`${API_URL}/orders`),
        axios.get(`${API_URL}/tickets`),
      ]);

      setOrders(ordersResponse.data);
      setTickets(ticketsResponse.data);
    } catch (error) {
      console.error("Could not load dashboard data:", error);
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      await axios.patch(
        `${API_URL}/tickets/${ticketId}/status`,
        {
          status: newStatus,
        }
      );

      await loadData();
    } catch (error) {
      console.error("Could not update ticket status:", error);
      alert("Could not update ticket status.");
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();

    setChatMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: userMessage,
        tools: [],
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/chat`, {
        message: userMessage,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: response.data.response,
          tools: response.data.tool_used || [],
        },
      ]);

      // Refresh tickets because the AI may have created one
      loadData();
    } catch (error) {
      console.error(error);

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, I couldn't process that request. Please check that the backend is running.",
          tools: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const uploadDocument = async () => {
    if (!selectedFile) {
      setUploadMessage("Please select a PDF or TXT file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploading(true);
    setUploadMessage("");

    try {
      const response = await axios.post(
        `${API_URL}/knowledge/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        setUploadMessage(
          `${response.data.filename} added successfully. ${response.data.chunks_created} RAG chunks created.`
        );
        setSelectedFile(null);
      } else {
        setUploadMessage(response.data.error || "Upload failed.");
      }
    } catch (error) {
      console.error(error);
      setUploadMessage("Could not upload the document.");
    } finally {
      setUploading(false);
    }
  };

  const openTickets = tickets.filter(
    (ticket) => ticket.status?.toLowerCase() === "open"
  ).length;

  const highPriorityTickets = tickets.filter(
    (ticket) => ticket.priority?.toLowerCase() === "high"
  ).length;

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">S</div>

          <div>
            <h2>SupportPilot</h2>
            <span>Agentic AI Support</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button
            className={activePage === "dashboard" ? "nav-item active" : "nav-item"}
            onClick={() => setActivePage("dashboard")}
          >
            <span>⌂</span>
            Dashboard
          </button>

          <button
            className={activePage === "chat" ? "nav-item active" : "nav-item"}
            onClick={() => setActivePage("chat")}
          >
            <span>✦</span>
            AI Support
          </button>

          <button
            className={activePage === "tickets" ? "nav-item active" : "nav-item"}
            onClick={() => setActivePage("tickets")}
          >
            <span>▣</span>
            Tickets

            {openTickets > 0 && (
              <span className="nav-badge">{openTickets}</span>
            )}
          </button>

          <button
            className={activePage === "orders" ? "nav-item active" : "nav-item"}
            onClick={() => setActivePage("orders")}
          >
            <span>□</span>
            Orders
          </button>

          <button
            className={
              activePage === "knowledge" ? "nav-item active" : "nav-item"
            }
            onClick={() => setActivePage("knowledge")}
          >
            <span>◇</span>
            Knowledge Base
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="ai-status">
            <div className="status-dot"></div>

            <div>
              <strong>AI Agent Online</strong>
              <span>Groq + RAG + Tools</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">CUSTOMER SUPPORT PLATFORM</p>
            <h1>
              {activePage === "dashboard" && "Dashboard"}
              {activePage === "chat" && "AI Support Agent"}
              {activePage === "tickets" && "Support Tickets"}
              {activePage === "orders" && "Customer Orders"}
              {activePage === "knowledge" && "Knowledge Base"}
            </h1>
          </div>

          <div className="topbar-right">
            <div className="live-pill">
              <span></span>
              Agent Online
            </div>

            <div className="avatar">SP</div>
          </div>
        </header>

        {/* DASHBOARD */}
        {activePage === "dashboard" && (
          <section className="page">
            <div className="welcome-card">
              <div>
                <p className="welcome-label">SUPPORTPILOT AI</p>

                <h2>AI support that can actually take action.</h2>

                <p>
                  SupportPilot searches company knowledge, checks live orders,
                  and escalates complex issues automatically.
                </p>

                <button
                  className="primary-btn"
                  onClick={() => setActivePage("chat")}
                >
                  Open AI Support
                </button>
              </div>

              <div className="agent-visual">
                <div className="agent-ring">
                  <div className="agent-core">AI</div>
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon purple">◎</div>

                <div>
                  <span>Total Orders</span>
                  <strong>{orders.length}</strong>
                  <small>Connected database</small>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon orange">▣</div>

                <div>
                  <span>Open Tickets</span>
                  <strong>{openTickets}</strong>
                  <small>Awaiting human review</small>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon red">!</div>

                <div>
                  <span>High Priority</span>
                  <strong>{highPriorityTickets}</strong>
                  <small>Requires attention</small>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon green">✦</div>

                <div>
                  <span>AI Tools</span>
                  <strong>3</strong>
                  <small>RAG, orders, tickets</small>
                </div>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Recent Tickets</h3>
                    <p>Issues escalated by the AI agent</p>
                  </div>

                  <button
                    className="text-btn"
                    onClick={() => setActivePage("tickets")}
                  >
                    View all
                  </button>
                </div>

                {tickets.length === 0 ? (
                  <div className="empty-state">
                    No support tickets yet.
                  </div>
                ) : (
                  <div className="ticket-list">
                    {tickets
                      .slice()
                      .reverse()
                      .slice(0, 4)
                      .map((ticket) => (
                        <div className="ticket-row" key={ticket.id}>
                          <div className="ticket-avatar">
                            {ticket.id}
                          </div>

                          <div className="ticket-info">
                            <strong>{ticket.title}</strong>
                            <span>
                              {ticket.order_number || "No order linked"}
                            </span>
                          </div>

                          <span
                            className={`priority ${ticket.priority?.toLowerCase()}`}
                          >
                            {ticket.priority}
                          </span>

                          <span className="ticket-status">
                            {ticket.status}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="panel agent-panel">
                <div className="panel-header">
                  <div>
                    <h3>Agent Capabilities</h3>
                    <p>Available autonomous tools</p>
                  </div>
                </div>

                <div className="capability">
                  <div className="capability-icon">01</div>

                  <div>
                    <strong>Order Lookup</strong>
                    <span>Queries customer orders from SQLite</span>
                  </div>

                  <b>Active</b>
                </div>

                <div className="capability">
                  <div className="capability-icon">02</div>

                  <div>
                    <strong>RAG Search</strong>
                    <span>Searches company policies with FAISS</span>
                  </div>

                  <b>Active</b>
                </div>

                <div className="capability">
                  <div className="capability-icon">03</div>

                  <div>
                    <strong>Human Escalation</strong>
                    <span>Creates support tickets automatically</span>
                  </div>

                  <b>Active</b>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* AI CHAT */}
        {activePage === "chat" && (
          <section className="page chat-page">
            <div className="chat-container">
              <div className="chat-header">
                <div className="chat-agent-avatar">AI</div>

                <div>
                  <h3>SupportPilot Agent</h3>
                  <span>
                    <i></i>
                    Online · Agentic mode
                  </span>
                </div>
              </div>

              <div className="messages">
                {chatMessages.map((chat, index) => (
                  <div
                    key={index}
                    className={
                      chat.role === "user"
                        ? "message-wrap user-wrap"
                        : "message-wrap"
                    }
                  >
                    {chat.role === "assistant" && (
                      <div className="mini-avatar">AI</div>
                    )}

                    <div>
                      <div
                        className={
                          chat.role === "user"
                            ? "message user-message"
                            : "message assistant-message"
                        }
                      >
                        {chat.text}
                      </div>

                      {chat.tools?.length > 0 && (
                        <div className="tool-activity">
                          <span className="tool-title">
                            ✦ Agent activity
                          </span>

                          {chat.tools.map((tool, toolIndex) => (
                            <div className="tool-chip" key={toolIndex}>
                              ✓ {tool}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="message-wrap">
                    <div className="mini-avatar">AI</div>

                    <div className="thinking">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}
              </div>

              <div className="chat-input-area">
                <div className="suggestion-row">
                  <button
                    onClick={() =>
                      setMessage("Where is order ORD-1001?")
                    }
                  >
                    Check an order
                  </button>

                  <button
                    onClick={() =>
                      setMessage(
                        "Can I return a product after 20 days?"
                      )
                    }
                  >
                    Ask return policy
                  </button>

                  <button
                    onClick={() =>
                      setMessage(
                        "I was charged twice for order ORD-1001."
                      )
                    }
                  >
                    Report payment issue
                  </button>
                </div>

                <div className="input-box">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask SupportPilot anything..."
                  />

                  <button
                    onClick={sendMessage}
                    disabled={loading || !message.trim()}
                  >
                    ➜
                  </button>
                </div>

                <small>
                  SupportPilot can search knowledge, check orders,
                  and create support tickets.
                </small>
              </div>
            </div>
          </section>
        )}

        {/* TICKETS */}
        {activePage === "tickets" && (
          <section className="page">
            <div className="panel full-panel">
              <div className="panel-header">
                <div>
                  <h3>Support Tickets</h3>
                  <p>Human escalations created by the AI agent</p>
                </div>

                <button className="secondary-btn" onClick={loadData}>
                  Refresh
                </button>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Issue</th>
                      <th>Order</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>TKT-{String(ticket.id).padStart(4, "0")}</td>

                        <td>
                          <strong>{ticket.title}</strong>
                          <small>{ticket.description}</small>
                        </td>

                        <td>{ticket.order_number || "—"}</td>

                        <td>
                          <span
                            className={`priority ${ticket.priority?.toLowerCase()}`}
                          >
                            {ticket.priority}
                          </span>
                        </td>

                        <td>
                          <select
                            className={`status-select ${
                              ticket.status === "Resolved"
                                ? "resolved"
                                : ticket.status === "In Progress"
                                ? "progress"
                                : "open"
                            }`}
                            value={ticket.status}
                            onChange={(e) =>
                              updateTicketStatus(
                                ticket.id,
                                e.target.value
                              )
                            }
                          >
                            <option value="Open">Open</option>

                            <option value="In Progress">
                              In Progress
                            </option>

                            <option value="Resolved">
                              Resolved
                            </option>
                          </select>
                        </td>

                        <td>
                          {ticket.created_at
                            ? new Date(ticket.created_at).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}

                    {tickets.length === 0 && (
                      <tr>
                        <td colSpan="6" className="table-empty">
                          No tickets created yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ORDERS */}
        {activePage === "orders" && (
          <section className="page">
            <div className="panel full-panel">
              <div className="panel-header">
                <div>
                  <h3>Customer Orders</h3>
                  <p>Orders connected to the agent database</p>
                </div>

                <button className="secondary-btn" onClick={loadData}>
                  Refresh
                </button>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Product</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Tracking</th>
                      <th>Expected Delivery</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.order_number}</strong>
                        </td>

                        <td>{order.product}</td>

                        <td>${Number(order.amount).toFixed(2)}</td>

                        <td>
                          <span className="order-status">
                            {order.status}
                          </span>
                        </td>

                        <td>{order.tracking_number || "Not available"}</td>

                        <td>{order.expected_delivery || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* KNOWLEDGE BASE */}
        {activePage === "knowledge" && (
          <section className="page">
            <div className="knowledge-grid">
              <div className="panel upload-panel">
                <div className="panel-header">
                  <div>
                    <h3>Add Knowledge</h3>
                    <p>Upload company documents for RAG</p>
                  </div>
                </div>

                <div className="upload-zone">
                  <div className="upload-icon">↑</div>

                  <h3>Upload company knowledge</h3>

                  <p>
                    Add refund policies, shipping rules, warranty
                    information, FAQs, and other support documents.
                  </p>

                  <label className="file-button">
                    Select PDF or TXT
                    <input
                      type="file"
                      accept=".pdf,.txt"
                      onChange={(e) =>
                        setSelectedFile(e.target.files[0])
                      }
                    />
                  </label>

                  {selectedFile && (
                    <div className="selected-file">
                      ✓ {selectedFile.name}
                    </div>
                  )}

                  <button
                    className="primary-btn upload-button"
                    onClick={uploadDocument}
                    disabled={!selectedFile || uploading}
                  >
                    {uploading
                      ? "Indexing document..."
                      : "Add to Knowledge Base"}
                  </button>

                  {uploadMessage && (
                    <div className="upload-result">
                      {uploadMessage}
                    </div>
                  )}
                </div>
              </div>

              <div className="panel rag-info">
                <div className="rag-badge">RAG</div>

                <h2>Retrieval-Augmented Generation</h2>

                <p>
                  Uploaded documents are converted into embeddings
                  and indexed with FAISS. The support agent searches
                  these documents before answering policy questions.
                </p>

                <div className="rag-flow">
                  <span>Document</span>
                  <b>→</b>
                  <span>Chunks</span>
                  <b>→</b>
                  <span>Embeddings</span>
                  <b>→</b>
                  <span>FAISS</span>
                  <b>→</b>
                  <span>AI</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;