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


function displaySystemMessage(message) {
    const systemMessage = document.createElement('div');
    systemMessage.classList.add('message', 'system');
    systemMessage.innerText = message;
    chatContainer.appendChild(systemMessage);
    chatContainer.scrollTop = chatContainer.scrollHeight;
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

// Handle the API response
async function sendMessage(question) {
    const userMessage = question || userInput.value.trim();
    if (!userMessage) return;

    appendMessage('User', userMessage);
    userInput.value = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: userMessage })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.answer) {
            appendMessage('Assistant', data.answer);
        } else if (data.potential_answer) {
            appendMessage('Assistant', data.potential_answer);
        } else {
            appendMessage('Assistant', 'I couldn\'t find an answer to your question.');
        }
    } catch (error) {
        console.error('Error:', error);
        appendMessage('Assistant', `Error: ${error.message}`);
    }
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
