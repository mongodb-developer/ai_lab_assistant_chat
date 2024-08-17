/**
 * Displays the user management interface and loads user data.
 * @function
 * @async
 */
export async function showUsers() {
    const contentElement = document.getElementById('main-content');
    if (!contentElement) {
        console.error('Content element not found');
        return;
    }
    contentElement.innerHTML = `
        <div id="users-content">
            <h2>User Management</h2>
            <div class="table-responsive">
                <table class="table table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Last Seen</th>
                            <th>Admin</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body">
                        <tr><td colspan="4">Loading users...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    try {
        await fetchUsers();
    } catch (error) {
        console.error('Error in showUsers:', error);
        const usersTableBody = document.getElementById('users-table-body');
        if (usersTableBody) {
            usersTableBody.innerHTML = `<tr><td colspan="4">Error loading users: ${error.message}</td></tr>`;
        }
    }
}

/**
 * Fetches user data from the server and populates the users table.
 * @function
 * @async
 */
export async function fetchUsers() {
    try {
        const response = await fetch('/api/users');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const users = await response.json();
        populateUsersTable(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        const usersTableBody = document.getElementById('users-table-body');
        if (usersTableBody) {
            usersTableBody.innerHTML = `<tr><td colspan="4">Error loading users: ${error.message}</td></tr>`;
        }
    }
}

/**
 * Populates the users table with the provided user data.
 * @function
 * @param {Array} users - An array of user objects to display in the table.
 */
export function populateUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) {
        console.error('Could not find users-table-body element.');
        return;
    }
    tableBody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.last_login}</td>
        <td>${user.isAdmin ? 'Yes' : 'No'}</td>
        <td>
<button class="btn btn-sm btn-primary toggle-admin-btn" data-id="${user._id}" data-is-admin="${user.isAdmin}">Toggle Admin</button>

        </td>
    `;
        tableBody.appendChild(row);
    });
    document.querySelectorAll('.toggle-admin-btn').forEach(button => {
        button.addEventListener('click', function() {
            toggleAdminStatus(this);
        });
    });
}

/**
 * Displays the edit user form in a modal.
 * @function
 * @param {HTMLElement} button - The button element that triggered the action.
 */
export function showEditUserForm(button) {
    const id = button.getAttribute('data-id');
    const isAdmin = button.getAttribute('data-is-admin') === 'true';
    document.getElementById('user-id').value = id;
    document.getElementById('user-is-admin').checked = isAdmin;
    const modal = new bootstrap.Modal(document.getElementById('user-modal'));
    modal.show();
}

/**
 * Updates a user's admin status.
 * @function
 * @async
 */
export async function updateUser() {
    const id = document.getElementById('user-id').value;
    const isAdmin = document.getElementById('user-is-admin').checked;
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isAdmin }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        await fetchUsers();
        const modal = bootstrap.Modal.getInstance(document.getElementById('user-modal'));
        modal.hide();
    } catch (error) {
        console.error('Error updating user:', error);
    }
}

/**
 * Retrieves the current user's ID.
 * @function
 * @async
 * @returns {string|null} The user ID if successful, null otherwise.
 */
export async function getCurrentUserId() {
    try {
        const response = await fetch('/api/current_user_id', {
            credentials: 'include' // This ensures cookies are sent with the request
        });
        if (response.status === 401) {
            // User is not authenticated, redirect to login
            window.location.href = '/login';
            return null;
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.userId;
    } catch (error) {
        console.error('Error getting current user ID:', error);
        return null;
    }
}

/**
 * Toggles the admin status of a user.
 * @function
 * @async
 * @param {HTMLElement} button - The button element that triggered the action.
 */
export async function toggleAdminStatus(button) {
    const id = button.getAttribute('data-id');
    const isAdmin = button.getAttribute('data-is-admin') === 'true';
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isAdmin: !isAdmin }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        await fetchUsers();
    } catch (error) {
        console.error('Error updating user:', error);
    }
}