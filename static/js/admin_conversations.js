// Fetch and display conversations
async function fetchConversations() {
    try {
        const response = await fetch('/api/conversations');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const conversations = await response.json();
        populateConversationsTable(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
    }
}

// Populate conversations table with data
function populateConversationsTable(conversations) {
    const tableBody = document.getElementById('conversations-table-body');
    if (!tableBody) {
        console.error('Element with ID "conversations-table-body" not found.');
        return;
    }
    tableBody.innerHTML = '';
    conversations.forEach(conversation => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${conversation.user}</td>
            <td>${conversation.question}</td>
            <td>${conversation.answer}</td>
            <td>${new Date(conversation.timestamp).toLocaleString()}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Load conversations when the Conversations tab is clicked
function showConversations() {
    document.getElementById('content').innerHTML = `
        <div id="conversations-content">
            <h2>Conversations</h2>
            <div class="table-responsive mt-3">
                <table class="table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Question</th>
                            <th>Answer</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody id="conversations-table-body">
                        <!-- Conversations data will be populated here -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    fetchConversations();
}

// Call showConversations when the document is loaded
document.addEventListener('DOMContentLoaded', showConversations);
