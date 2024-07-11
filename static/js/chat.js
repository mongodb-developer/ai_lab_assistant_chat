// Define references to HTML elements
const conversationList = document.getElementById('conversation-list');
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const adminForm = document.getElementById('admin-form'); // Ensure this is only referenced if it exists

// Verify if the elements are correctly referenced
console.log('conversationList:', conversationList);
console.log('chatContainer:', chatContainer);
console.log('userInput:', userInput);
console.log('adminForm:', adminForm);

// Send a message to the server
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
            console.log('Raw assistant message:', data.answer);  // Debug log
            appendMessage('assistant', data.answer);
        }
    } catch (error) {
        console.error('Error:', error);
        appendMessage('assistant', `An error occurred: ${error.message}`);
    } finally {
        loader.remove();
    }
}

// Handle sample question button clicks
function handleSampleQuestion(question) {
    userInput.value = question;
    sendMessage();
}

// Append a new message to the chat container
function appendMessage(sender, message) {
    console.log(`Appending message from ${sender}:`, message);
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-bubble', sender.toLowerCase());

    if (sender.toLowerCase() === 'assistant') {
        console.log('Before processing:', message);
        
        // Remove <p> tags but keep line breaks
        let processedMessage = message.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n').trim();
        
        // Replace <br> tags with newlines
        processedMessage = processedMessage.replace(/<br>/g, '\n');
        
        // Strip any remaining HTML tags
        processedMessage = stripHtml(processedMessage);
        
        console.log('After processing, before Markdown parsing:', processedMessage);
        
        // Configure marked
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });
        
        // Parse the processed message
        let parsedMessage = marked.parse(processedMessage);
        
        console.log('After Markdown parsing:', parsedMessage);
        
        // Use DOMPurify to sanitize the HTML produced by marked, if available
        if (typeof DOMPurify !== 'undefined') {
            parsedMessage = DOMPurify.sanitize(parsedMessage);
        } else {
            console.warn('DOMPurify is not available. Skipping sanitization.');
        }
        
        messageElement.innerHTML = parsedMessage;
    } else {
        const span = document.createElement('span');
        span.textContent = message;
        messageElement.appendChild(span);
    }

    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Strip HTML tags from a string
function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

// Append a loader to the chat container
function appendLoader() {
    const loaderElement = document.createElement('div');
    loaderElement.classList.add('loader');
    chatContainer.appendChild(loaderElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loaderElement;
}

// Append debug information to the chat container
function appendDebugInfo(title, debugInfo) {
    const debugElement = document.createElement('details');
    debugElement.innerHTML = `<summary>${title}</summary><pre>${JSON.stringify(debugInfo, null, 2)}</pre>`;
    debugElement.style.color = 'gray';
    debugElement.style.fontSize = '0.8em';
    chatContainer.appendChild(debugElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Event listener for admin form submission
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

// Event listener for Enter key press to send a message
document.addEventListener('DOMContentLoaded', function() {
    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        });
    }
});
