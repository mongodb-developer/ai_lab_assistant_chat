/**
 * chat.js - Chat Functionality Module
 * 
 * This module handles the core chat functionality for the application.
 * It manages user interactions, message sending and receiving, and
 * various UI elements related to the chat interface.
 *
 * @module chat
 */



let chatContainer;
let userInput;
let currentConversationId = null;

/**
 * Initializes the chat functionality.
 * 
 * @function
 * @name initChat
 * @returns {boolean} True if initialization was successful, false otherwise.
 */
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

/**
 * Displays a system message in the chat container.
 * 
 * @function
 * @name displaySystemMessage
 * @param {string} message - The system message to display.
 */
function displaySystemMessage(message) {
    const systemMessage = document.createElement('div');
    systemMessage.classList.add('message', 'system');
    systemMessage.innerText = message;
    chatContainer.appendChild(systemMessage);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Handles a sample question by populating the input field and sending the message.
 * 
 * @function
 * @name handleSampleQuestion
 * @param {string} question - The sample question to handle.
 */
function handleSampleQuestion(question) {
    if (!chatContainer || !userInput) {
        console.error('Chat not properly initialized. Cannot handle sample question.');
        return;
    }

    userInput.value = question;
    sendMessage(question);
}

/**
 * Appends a message to the chat container.
 * 
 * @function
 * @name appendMessage
 * @param {string} sender - The sender of the message ('User' or 'Assistant').
 * @param {string} message - The message content.
 * @param {Object} [data=null] - Additional data associated with the message.
 */
function appendMessage(sender, message, data = null) {
    if (!chatContainer) {
        console.error('Chat container not available. Message not appended.');
        return;
    }

    console.log(`Appending message from ${sender}:`, message);
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-bubble', sender.toLowerCase());

    if (sender.toLowerCase() === 'assistant') {
        // Use marked to render Markdown for assistant messages
        messageElement.innerHTML = marked.parse(escapeSpecialChars(message));
    } else {
        const span = document.createElement('span');
        span.textContent = escapeSpecialChars(message);
        messageElement.appendChild(span);
    }

    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // If it's an assistant message and we have additional data, add feedback buttons
    if (sender.toLowerCase() === 'assistant' && data) {
        appendFeedbackButtons(messageElement, data);
    }
}

/**
 * Appends a message to the chat container.
 * 
 * @function
 * @name appendFeedbackButtons
 * @param {string} messageElement
 * @param {Object} [data=null] - Additional data associated with the message.
 */
function appendFeedbackButtons(messageElement, data) {
    const feedbackContainer = document.createElement('div');
    feedbackContainer.classList.add('feedback-container');

    const positiveButton = document.createElement('button');
    positiveButton.textContent = '👍';
    positiveButton.onclick = () => provideAnswerFeedback(data.question_id, data.original_question, data.answer, true);

    const negativeButton = document.createElement('button');
    negativeButton.textContent = '👎';
    negativeButton.onclick = () => provideAnswerFeedback(data.question_id, data.original_question, data.answer, false);

    feedbackContainer.appendChild(positiveButton);
    feedbackContainer.appendChild(negativeButton);

    messageElement.appendChild(feedbackContainer);
}

/**
 * Sends a user message to the server and handles the response.
 * 
 * @async
 * @function
 * @name sendMessage
 * @param {Event|string} event - The event object from a button click or a string message.
 */
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

/**
 * Starts a new conversation by resetting the conversation ID and clearing the chat container.
 * 
 * @function
 * @name startNewConversation
 */
function startNewConversation() {
    currentConversationId = null;
    clearChatContainer();
}

/**
 * Strips HTML tags from a given string.
 * 
 * @function
 * @name stripHtml
 * @param {string} html - The HTML string to strip.
 * @returns {string} The text content without HTML tags.
 */
function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

/**
 * Appends a loader overlay to the document body.
 * 
 * @function
 * @name appendLoader
 * @returns {HTMLElement} The created loader overlay element.
 */
function appendLoader() {
    const loaderOverlay = document.createElement('div');
    loaderOverlay.classList.add('loader-overlay');

    const loaderElement = document.createElement('div');
    loaderElement.classList.add('loader');
    loaderOverlay.appendChild(loaderElement);

    document.body.appendChild(loaderOverlay);
    return loaderOverlay;
}

/**
 * Removes the loader overlay from the document.
 * 
 * @function
 * @name removeLoader
 * @param {HTMLElement} loaderOverlay - The loader overlay element to remove.
 */
function removeLoader(loaderOverlay) {
    if (loaderOverlay && loaderOverlay.parentNode) {
        loaderOverlay.parentNode.removeChild(loaderOverlay);
    }
}

/**
 * Appends debug information to the chat container.
 * 
 * @function
 * @name appendDebugInfo
 * @param {string} title - The title for the debug information.
 * @param {Object} debugInfo - The debug information to display.
 */
function appendDebugInfo(title, debugInfo) {
    const debugElement = document.createElement('details');
    debugElement.innerHTML = `<summary>${title}</summary><pre>${JSON.stringify(debugInfo, null, 2)}</pre>`;
    debugElement.style.color = 'gray';
    debugElement.style.fontSize = '0.8em';
    chatContainer.appendChild(debugElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Provides feedback for an answer.
 * 
 * @async
 * @function
 * @name provideAnswerFeedback
 * @param {string} questionId - The ID of the question.
 * @param {string} originalQuestion - The original question text.
 * @param {string} proposedAnswer - The proposed answer text.
 * @param {boolean} isPositive - Whether the feedback is positive.
 */
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
                original_question: originalQuestion || '',
                proposed_answer: proposedAnswer,
                is_positive: isPositive 
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        alert(result.message);
    } catch (error) {
        console.error('Error providing answer feedback:', error);
        console.error('Error details:', {
            questionId,
            originalQuestion,
            proposedAnswer: proposedAnswer.substring(0, 100) + '...',  // Log only the first 100 characters
            isPositive
        });
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

    var bookReviewBtn = document.getElementById('book-review-btn');
    var calendlyModal = new bootstrap.Modal(document.getElementById('calendlyModal'));

    bookReviewBtn.addEventListener('click', function () {
        calendlyModal.show();
    });

    // Ensure the modal is hidden completely and grey overlay is removed
    var modalElement = document.getElementById('calendlyModal');
    modalElement.addEventListener('hidden.bs.modal', function () {
        document.body.classList.remove('modal-open');
        var modalBackdrop = document.querySelector('.modal-backdrop');
        if (modalBackdrop) {
            modalBackdrop.remove();
        }
    });
    marked.setOptions({
        breaks: true,
        gfm: true,
        tables: true,
        sanitize: false, // Set to true if you want to sanitize HTML in the markdown
        smartLists: true,
        smartypants: true
    });
    console.log('Marked library loaded:', typeof marked);
    console.log('Markdown test:', marked.parse('# Hello\n\nThis is a **test**.'));


});

// Ensure `marked` is correctly loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Marked library loaded:', typeof marked);
    console.log('Markdown test:', marked.parse('# Hello\n\nThis is a **test**.'));
});

// if (adminForm) {
//     adminForm.addEventListener('submit', async (e) => {
//         e.preventDefault();
//         const question = document.getElementById('question').value;
//         const answer = document.getElementById('answer').value;

//         try {
//             const response = await fetch('/api/add_question', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({ question, answer }),
//             });

//             if (!response.ok) {
//                 throw new Error(`HTTP error! status: ${response.status}`);
//             }

//             const result = await response.json();
            
//             if (result.debug_info) {
//                 appendDebugInfo('Admin Debug Information', result.debug_info);
//             }
            
//             alert(result.message);
//             adminForm.reset();
//         } catch (error) {
//             console.error('Error:', error);
//             alert(`An error occurred: ${error.message}`);
//         }
//     });
// }

/**
 * Escapes special characters in a string to prevent XSS.
 * 
 * @function
 * @name escapeSpecialChars
 * @param {string} input - The input string to escape.
 * @returns {string} The escaped string.
 */
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