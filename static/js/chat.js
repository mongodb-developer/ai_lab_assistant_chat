// Define references to HTML elements
const conversationList = document.getElementById('conversation-list');
const adminForm = document.getElementById('admin-form');

let chatContainer;
let userInput;
let currentConversationId = null;

// Verify if the elements are correctly referenced
console.log('conversationList:', conversationList);
console.log('chatContainer:', chatContainer);
console.log('userInput:', userInput);
console.log('adminForm:', adminForm);

function initChat() {
    chatContainer = document.getElementById('chat-container');
    userInput = document.getElementById('user-input');
    
    if (!chatContainer) {
        console.error('Chat container not found. Make sure there is an element with id "chat-container" in your HTML.');
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

    if (sender.toLowerCase() === 'assistant') {
        messageElement.innerHTML = marked.parse(escapeSpecialChars(message));
    } else {
        const span = document.createElement('span');
        span.textContent = escapeSpecialChars(message);
        messageElement.appendChild(span);
    }

    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage(event) {
    if (!chatContainer || !userInput) {
        console.error('Chat not properly initialized. Cannot send message.');
        return;
    }
    
    let userMessage;
    if (event instanceof PointerEvent) {
        // If called from a button click
        userMessage = userInput.value.trim();
    } else if (typeof event === 'string') {
        // If called with a string argument (e.g., from sample questions)
        userMessage = event;
    } else {
        console.error('Invalid input to sendMessage');
        return;
    }

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
            body: JSON.stringify({ 
                question: userMessage,
                conversation_id: currentConversationId
            })
        });


        if (!response.ok) {
            const errorMessage = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
        }

        const data = await response.json();
                       
        if (data.debug_info) {
            appendDebugInfo('Debug Information', data.debug_info);
        }

        if (data.conversation_id) {
            currentConversationId = data.conversation_id;
        }

        console.log('Received data:', data);
        if (data.answer) {
            appendMessage('Assistant', data.answer, {
                ...data,
                question_id: data.question_id || '',
                original_question: userMessage
            });
        } else if (data.potential_answer) {
            appendMessage('Assistant', data.potential_answer, {
                ...data,
                question_id: '',
                original_question: userMessage
            });
        } else {
            appendMessage('Assistant', 'I couldn\'t find an answer to your question.');
        }
    } catch (error) {
        console.error('Error:', error);
        appendMessage('Assistant', `Error: ${error.message}`);
    } finally {
        removeLoader(loader);
    }
}

function startNewConversation() {
    currentConversationId = null;
    clearChatContainer();
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
    if (loaderOverlay && loaderOverlay.parentNode) {
        loaderOverlay.parentNode.removeChild(loaderOverlay);
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
    if (!initChat()) {
        console.error('Failed to initialize chat. Some features may not work correctly.');
    }
    
    const fab = document.getElementById('sample-questions-fab');
    const modal = document.getElementById('sample-questions-modal');
    const sampleQuestions = document.querySelectorAll('.sample-question');
    const sendButton = document.getElementById('send-button');

    if (fab) {
        fab.addEventListener('click', function() {
            modal.style.display = 'block';
        });
    }

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    if (userInput) {
        userInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                sendMessage(event);
            }
        });
    }

    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    sampleQuestions.forEach(question => {
        question.addEventListener('click', function() {
            const questionText = this.textContent;
            if (userInput) {
                userInput.value = questionText;
            }
            modal.style.display = 'none';
            sendMessage(questionText);
        });
    });
});

// Ensure `marked` is correctly loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Marked library loaded:', typeof marked);
    console.log('Markdown test:', marked.parse('# Hello\n\nThis is a **test**.'));
    document.getElementById('conversations-pagination').addEventListener('click', function(e) {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const page = parseInt(e.target.getAttribute('data-page'));
            loadConversations(page);
        }
    });

    document.getElementById('conversations-body').addEventListener('click', function(e) {
        if (e.target.classList.contains('view-conversation')) {
            const conversationId = e.target.getAttribute('data-id');
            viewConversation(conversationId);
        }
    });
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

function escapeSpecialChars(input) {
    if (typeof input !== 'string') {
        console.warn(`escapeSpecialChars received non-string input: ${typeof input}`);
        return String(input); // Convert to string if it's not already
    }
    return input.replace(/[&<>"']/g, function(m) {
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