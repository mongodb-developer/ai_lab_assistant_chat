

let currentPage = 1;
const perPage = 10;
const viewConversationsLink = document.getElementById('view-conversations-link');
if (viewConversationsLink) {
    viewConversationsLink.addEventListener('click', function (e) {
        e.preventDefault();
        showConversations();
    });
} else {
    console.error('View conversations link not found');
}
document.getElementById('conversations-pagination').addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
        e.preventDefault();
        const page = parseInt(e.target.getAttribute('data-page'));
        loadConversations(page);
    }
});

document.getElementById('conversations-body').addEventListener('click', function (e) {
    if (e.target.classList.contains('view-conversation')) {
        const conversationId = e.target.getAttribute('data-id');
        viewConversation(conversationId);
    }
});
/**
 * Displays a list of conversations and handles pagination.
 *
 * @function showConversations
 */
export function showConversations() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }

    // Clear existing content
    mainContent.innerHTML = '';

    // Create conversations container
    const conversationsContainer = document.createElement('div');
    conversationsContainer.id = 'conversations';
    conversationsContainer.innerHTML = `
            <h2>Conversations</h2>
            <div id="conversations-table" class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Last Updated</th>
                            <th>Preview</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="conversations-body">
                    </tbody>
                </table>
            </div>
            <nav aria-label="Conversations pagination">
                <ul class="pagination" id="conversations-pagination">
                </ul>
            </nav>
        `;

    mainContent.appendChild(conversationsContainer);

    // Load the first page of conversations
    loadConversations(1);
}

/**
 * Loads a specific page of conversations.
 *
 * @function loadConversations
 * @param {number} page - The page number to load
 */
export function loadConversations(page) {
    fetch(`/api/conversations?page=${page}&per_page=10`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const tableBody = document.getElementById('conversations-body');
            if (!tableBody) {
                console.error('Conversations table body not found');
                return;
            }
            tableBody.innerHTML = '';

            data.conversations.forEach(conv => {
                const row = document.createElement('tr');
                row.innerHTML = `
                        <td>${escapeHTML(conv.user_name)}</td>
                        <td>${conv.last_updated === 'Unknown' ? 'Unknown' : new Date(conv.last_updated).toLocaleString()}</td>
                        <td>${conv.preview.map(escapeHTML).join('<br>')}</td>
                        <td>
                            <button class="btn btn-sm btn-primary view-conversation" data-id="${conv._id}">View</button>
                        </td>
                    `;
                tableBody.appendChild(row);
            });

            updateConversationPagination(data.page, data.total_pages);
        })
        .catch(error => {
            console.error('Error loading conversations:', error);
            const errorMessage = `Failed to load conversations. ${error.message}`;
            showError(errorMessage);
            const tableBody = document.getElementById('conversations-body');
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="4">Error loading conversations: ${escapeHTML(error.message)}</td></tr>`;
            }
        });
}

export function updateConversationPagination(currentPage, totalPages) {
    const pagination = document.getElementById('conversations-pagination');
    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        pagination.appendChild(li);
    }
}

/**
 * Displays details of a specific conversation.
 *
 * @function viewConversation
 * @param {string} conversationId - The ID of the conversation to view
 */
export function viewConversation(conversationId) {
    fetch(`/api/conversations/${conversationId}`)
        .then(response => response.json())
        .then(data => {
            const modalContent = `
                    <div class="modal-header">
                        <h5 class="modal-title">Conversation Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>User Name:</strong> ${escapeHTML(data.user_name)}</p>
                        <p><strong>Last Updated:</strong> ${data.last_updated === 'Unknown' ? 'Unknown' : new Date(data.last_updated).toLocaleString()}</p>
                        <h6>Messages:</h6>
                        <ul>
                            ${data.messages.map(msg => `<li><strong>${escapeHTML(msg.role)}:</strong> ${escapeHTML(msg.content)}</li>`).join('')}
                        </ul>
                    </div>
                `;

            const modalElement = document.getElementById('conversationModal') || createConversationModal();
            modalElement.querySelector('.modal-content').innerHTML = modalContent;

            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        })
        .catch(error => {
            console.error('Error viewing conversation:', error);
            alert('Failed to load conversation details. Please try again.');
        });
}
export function createConversationModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'conversationModal';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = '<div class="modal-dialog modal-lg"><div class="modal-content"></div></div>';
    document.body.appendChild(modal);
    return modal;
}
