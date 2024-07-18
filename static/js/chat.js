// Define references to HTML elements
const conversationList = document.getElementById('conversation-list');
const adminForm = document.getElementById('admin-form');

let chatContainer;
let userInput;

// Verify if the elements are correctly referenced
console.log('conversationList:', conversationList);
console.log('chatContainer:', chatContainer);
console.log('userInput:', userInput);
console.log('adminForm:', adminForm);

function initChat() {
    chatContainer = document.querySelector('.chat-container-wrapper .chat-container');
    userInput = document.getElementById('user-input');

    if (!chatContainer) {
        console.error('Chat container not found. Make sure there is an element with class "chat-container" inside an element with class "chat-container-wrapper" in your HTML.');
        return false;
    }

    if (!userInput) {
        console.error('User input not found. Make sure there is an input element with id "user-input" in your HTML.');
        return false;
    }

    userInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    console.log('Chat initialized successfully');
    return true;
}

function displaySystemMessage(message) {
    const systemMessage = document.createElement('div');
    systemMessage.classList.add('message', 'system');
    systemMessage.innerText = message;
    chatContainer.appendChild(systemMessage);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function handleSampleQuestion(question) {
    if (!chatContainer || !userInput) {
        console.error('Chat not properly initialized. Cannot handle sample question.');
        return;
    }

    userInput.value = question;
    sendMessage(question);
}

function appendMessage(sender, message, data = null) {
    if (!chatContainer) {
        console.error('Chat container not available. Message not appended.');
        return;
    }

    console.log(`Appending message from ${sender}:`, message);
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-bubble', sender.toLowerCase());

    if (sender.toLowerCase() === 'assistant' && data) {
        const { title, summary, answer, references, question_id, original_question } = data;

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

        // Add feedback buttons
        const feedbackDiv = document.createElement('div');
        feedbackDiv.classList.add('feedback-buttons');
        
        const escapedQuestionId = escapeSpecialChars(question_id || '');
        const escapedOriginalQuestion = escapeSpecialChars(original_question || '');
        const escapedAnswer = escapeSpecialChars(answer || '');

        feedbackDiv.innerHTML = `
            <p>Was this answer helpful?</p>
            <button class="btn btn-sm btn-outline-success" onclick="provideAnswerFeedback('${escapedQuestionId}', '${encodeURIComponent(escapedOriginalQuestion)}', '${encodeURIComponent(escapedAnswer)}', true)">Yes</button>
            <button class="btn btn-sm btn-outline-danger" onclick="provideAnswerFeedback('${escapedQuestionId}', '${encodeURIComponent(escapedOriginalQuestion)}', '${encodeURIComponent(escapedAnswer)}', false)">No</button>
        `;
        messageElement.appendChild(feedbackDiv);
    } else {
        const span = document.createElement('span');
        span.textContent = message;
        messageElement.appendChild(span);
    }

    chatContainer.insertBefore(messageElement, chatContainer.lastElementChild);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage(question) {
    if (!chatContainer || !userInput) {
        console.error('Chat not properly initialized. Cannot send message.');
        return;
    }
    
    const userMessage = question || userInput.value.trim();
    if (!userMessage) return;

    appendMessage('User', userMessage);
    userInput.value = '';

    const loader = appendLoader();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: userMessage })
        });

        removeLoader(loader);

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
            appendMessage('Assistant', data.answer, {
                ...data,
                question_id: data.question_id || '',
                original_question: userMessage  // Use the original user message here
            });
        } else if (data.potential_answer) {
            appendMessage('Assistant', data.potential_answer, {
                ...data,
                question_id: '',  // No question_id for potential answers
                original_question: userMessage
            });
        } else {
            appendMessage('Assistant', 'I couldn\'t find an answer to your question.');
        }
    } catch (error) {
        console.error('Error:', error);
        removeLoader(loader);
        appendMessage('Assistant', `Error: ${error.message}`);
    }
}

function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function appendLoader() {
    const loaderOverlay = document.createElement('div');
    loaderOverlay.classList.add('loader-overlay');

    const loaderElement = document.createElement('div');
    loaderElement.classList.add('loader');
    loaderOverlay.appendChild(loaderElement);

    document.body.appendChild(loaderOverlay);
    return loaderOverlay;
}

function removeLoader(loaderOverlay) {
    if (loaderOverlay) {
        document.body.removeChild(loaderOverlay);
    }
}

function appendDebugInfo(title, debugInfo) {
    const debugElement = document.createElement('details');
    debugElement.innerHTML = `<summary>${title}</summary><pre>${JSON.stringify(debugInfo, null, 2)}</pre>`;
    debugElement.style.color = 'gray';
    debugElement.style.fontSize = '0.8em';
    chatContainer.appendChild(debugElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function provideAnswerFeedback(questionId, originalQuestion, proposedAnswer, isPositive) {
    if (!questionId && !originalQuestion) {
        console.error('Both questionId and originalQuestion are missing. Cannot provide feedback.');
        alert('Unable to submit feedback due to missing question information.');
        return;
    }

    try {
        const response = await fetch('/api/answer_feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                question_id: questionId || null, 
                original_question: decodeURIComponent(originalQuestion || ''),
                proposed_answer: decodeURIComponent(proposedAnswer),
                is_positive: isPositive 
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        alert(result.message);
    } catch (error) {
        console.error('Error providing answer feedback:', error);
        alert('Failed to submit answer feedback. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        });
    }
    if (!initChat()) {
        console.error('Failed to initialize chat. Some features may not work correctly.');
    }
});

// Ensure `marked` is correctly loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Marked library loaded:', typeof marked);
    console.log('Markdown test:', marked.parse('# Hello\n\nThis is a **test**.'));
});

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

function escapeSpecialChars(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}

window.handleSampleQuestion = handleSampleQuestion;
window.sendMessage = sendMessage;
window.provideAnswerFeedback = provideAnswerFeedback;