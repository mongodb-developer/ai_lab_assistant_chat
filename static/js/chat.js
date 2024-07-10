const conversationList = document.getElementById('conversation-list');
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const adminForm = document.getElementById('admin-form'); // Ensure this is only referenced if it exists

// Verify if the elements are correctly referenced
console.log('conversationList:', conversationList);
console.log('chatContainer:', chatContainer);
console.log('userInput:', userInput);
console.log('adminForm:', adminForm);

async function sendMessage() {
    const question = userInput.value;
    if (!question) return;

    appendMessage('user', question);
    userInput.value = '';

    const loader = appendLoader();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question }),
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.debug_info) {
            appendDebugInfo('Debug Information', data.debug_info);
        }

        if (data.error) {
            appendMessage('assistant', `Error: ${data.error}`);
        } else {
            appendMessage('assistant', data.answer);
        }
    } catch (error) {
        console.error('Error:', error);
        appendMessage('assistant', `An error occurred: ${error.message}`);
    } finally {
        loader.remove();
    }
}

function handleSampleQuestion(question) {
    userInput.value = question;
    sendMessage();
}

function appendMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-bubble', sender);
    messageElement.innerHTML = `<span>${message}</span>`;
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendLoader() {
    const loaderElement = document.createElement('div');
    loaderElement.classList.add('loader');
    chatContainer.appendChild(loaderElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loaderElement;
}

function appendDebugInfo(title, debugInfo) {
    const debugElement = document.createElement('details');
    debugElement.innerHTML = `<summary>${title}</summary><pre>${JSON.stringify(debugInfo, null, 2)}</pre>`;
    debugElement.style.color = 'gray';
    debugElement.style.fontSize = '0.8em';
    chatContainer.appendChild(debugElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = document.getElementById('question').value;
        const answer = document.getElementById('answer').value;

        try {
            const response = await fetch('/api/add_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question, answer }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Display debug info for admin form submission
            if (result.debug_info) {
                appendDebugInfo('Admin Debug Information', result.debug_info);
            }
            
            alert(result.message);
            adminForm.reset();
        } catch (error) {
            console.error('Error:', error);
            alert(`An error occurred: ${error.message}`);
        }
    });
}

userInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

async function fetchConversations() {
    try {
        const response = await fetch('/api/conversations', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const conversations = await response.json();
        console.log('Conversations:', conversations);  // Debugging
        displayConversations(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
    }
}

function displayConversations(conversations) {
    conversationList.innerHTML = '';
    conversations.forEach(conversation => {
        const li = document.createElement('li');
        li.className = 'conversation-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <span>
                <strong>${conversation.title}</strong><br><span class="timestamp">${conversation.timestamp}</span>
            </span>
            <i class="fas fa-trash-alt delete-icon" onclick="deleteConversation('${conversation.id}')"></i>
        `;
        li.addEventListener('click', () => loadConversation(conversation.id));
        conversationList.appendChild(li);
    });
}

async function loadConversation(conversationId) {
    try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const messages = await response.json();
        chatContainer.innerHTML = '';
        messages.forEach(message => {
            appendMessage(message.sender, message.message);
        });
    } catch (error) {
        console.error('Error loading conversation:', error);
    }
}

async function deleteConversation(conversationId) {
    if (!confirm('Are you sure you want to delete this conversation?')) {
        return;
    }

    try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        fetchConversations(); // Refresh the conversation list
    } catch (error) {
        console.error('Error deleting conversation:', error);
    }
}

function startNewChat() {
    chatContainer.innerHTML = '';
    userInput.value = '';
    // Add any additional logic to start a new chat
}

// Fetch conversations on page load
document.addEventListener('DOMContentLoaded', fetchConversations);
