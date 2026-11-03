
import { useState } from "react";
import api from "./api";

function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await api.get("/admin/users");
      setUsers(response.data);

      const roles = {};
      response.data.forEach((user) => {
        roles[user.id] = user.role;
      });

      setSelectedRoles(roles);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not load users. Admin access is required."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(userId) {
    setMessage("");
    setError("");

    try {
      const response = await api.patch(
        `/admin/users/${userId}/role`,
        { role: selectedRoles[userId] }
      );

      setMessage(
        `${response.data.name}'s role was updated to ${response.data.role}.`
      );

      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not update the user's role."
      );
    }
  }

  return (
    <div className="admin-panel-page">
      <h2>Admin Dashboard</h2>
      <p>
        Manage registered users and assign their workspace roles.
      </p>

      <button type="button" onClick={loadUsers}>
        Load Users
      </button>

      {loading && <p>Loading users...</p>}
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}

      <div className="admin-user-list">
        {users.map((user) => (
          <div className="admin-user-card" key={user.id}>
            <div>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
              <small>Current role: {user.role}</small>
            </div>

            {user.role === "admin" ? (
              <strong>Administrator</strong>
            ) : (
              <div className="admin-role-controls">
                <select
                  value={selectedRoles[user.id] || user.role}
                  onChange={(event) =>
                    setSelectedRoles({
                      ...selectedRoles,
                      [user.id]: event.target.value,
                    })
                  }
                >
                  <option value="writer">Writer</option>
                  <option value="manager">Manager</option>
                  <option value="reviewer">Reviewer</option>
                </select>

                <button
                  type="button"
                  onClick={() => updateRole(user.id)}
                  disabled={
                    selectedRoles[user.id] === user.role
                  }
                >
                  Save Role
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminPanel;
