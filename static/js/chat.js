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
function appendMessage(sender, message, data = null) {
    console.log(`Appending message from ${sender}:`, message);
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-bubble', sender.toLowerCase());

    if (sender.toLowerCase() === 'assistant' && data) {
        const { title, summary, answer, references } = data;

        let structuredMessage = '';
        if (title) structuredMessage += `<h3>${title}</h3>`;
        if (summary) structuredMessage += `<p><strong>Summary:</strong> ${summary}</p>`;
        if (answer) structuredMessage += `<p>${marked.parse(answer)}</p>`;
        if (references) structuredMessage += `<p><strong>References:</strong> ${marked.parse(references)}</p>`;

        // Use DOMPurify to sanitize the HTML produced by marked
        if (typeof DOMPurify !== 'undefined') {
            structuredMessage = DOMPurify.sanitize(structuredMessage);
        } else {
            console.warn('DOMPurify is not available. Skipping sanitization.');
        }

        messageElement.innerHTML = structuredMessage;
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

    const loader = appendLoader(); // Start the loader

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: userMessage })
        });

        removeLoader(loader); // Remove the loader

        if (!response.ok) {
            const errorMessage = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
        }

        const data = await response.json();
                       
        if (data.debug_info) {
            appendDebugInfo('Debug Information', data.debug_info);
        }

        console.log('Received data:', data);
        if (data.answer) {
            appendMessage('Assistant', data.answer, data);
        } else if (data.potential_answer) {
            appendMessage('Assistant', data.potential_answer, data);
        } else {
            appendMessage('Assistant', 'I couldn\'t find an answer to your question.');
        }
    } catch (error) {
        console.error('Error:', error);
        removeLoader(loader); // Remove the loader in case of error
        appendMessage('Assistant', `Error: ${error.message}`);
    }
}

// Ensure `marked` is correctly loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Marked library loaded:', typeof marked);
    console.log('Markdown test:', marked.parse('# Hello\n\nThis is a **test**.'));
});

// Strip HTML tags from a string
function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

// // Append a loader to the chat container
// function appendLoader() {
//     const loaderElement = document.createElement('div');
//     loaderElement.classList.add('loader');
//     chatContainer.appendChild(loaderElement);
//     chatContainer.scrollTop = chatContainer.scrollHeight;
//     return loaderElement;
// }

// // Remove the loader from the chat container
// function removeLoader(loaderElement) {
//     if (loaderElement && loaderElement.parentNode === chatContainer) {
//         chatContainer.removeChild(loaderElement);
//     }
// }

// Append a full-screen loader overlay
function appendLoader() {
    const loaderOverlay = document.createElement('div');
    loaderOverlay.classList.add('loader-overlay');

    const loaderElement = document.createElement('div');
    loaderElement.classList.add('loader');
    loaderOverlay.appendChild(loaderElement);

    document.body.appendChild(loaderOverlay);
    return loaderOverlay;
}

// Remove the full-screen loader overlay
function removeLoader(loaderOverlay) {
    if (loaderOverlay) {
        document.body.removeChild(loaderOverlay);
    }
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
