(function() {
    let chatContainer;
    let currentConversationId = null;
    let currentFocus = -1;
    let chatState;

    document.addEventListener('DOMContentLoaded', function() {
        console.log("DOM fully loaded");
        chatState = loadChatState();
        console.log("Initial chat state:", chatState);
    
        // Reset any lingering connection string waiting states
        chatState.waitingForConnectionString = false;
        chatState.waitingForConnectionStringConfirmation = false;
        chatState.loadDataPending = false;
        chatState.addVectorsPending = false;
        saveChatState();
    
        console.log("Reset chat state:", chatState);
    
        // Initialize chatContainer
        chatContainer = document.getElementById('chat-container');
        if (!chatContainer) {
            console.error('Chat container not found');
            return;
        }

        document.getElementById('cancel-workflow').addEventListener('click', function() {
            chatState.waitingForConnectionString = false;
            chatState.loadDataPending = false;
            saveChatState();
            hideWorkflowIndicator();
            appendMessage('Assistant', "Workflow cancelled. How else can I assist you?");
        });

        const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    
        if (autocompleteDropdown) {
            autocompleteDropdown.addEventListener('click', function(event) {
                if (event.target.classList.contains('autocomplete-item')) {
                    const selectedText = event.target.textContent;
                    userInput.value = selectedText;
                    hideAutocompleteDropdown();
                }
            });
        }
    
        // Function to clear autocomplete
        function clearAutocomplete() {
            if (autocompleteDropdown) {
                autocompleteDropdown.innerHTML = '';
                autocompleteDropdown.style.display = 'none';
            }
        }
    

        const userInput = document.getElementById('user-input');
        if (autocompleteDropdown && !autocompleteDropdown.contains(event.target) && event.target !== userInput) {
            hideAutocompleteDropdown();
        }

        document.querySelectorAll('.ask-question').forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                const question = this.getAttribute('data-question');
                document.getElementById('user-input').value = question;
                sendMessage(null, question);
            });
        });
    

        if (userInput && autocompleteDropdown) {
            // Add keydown event listener to the user input
            userInput.addEventListener('keydown', function(event) {
                if (event.key === 'Escape') {
                    hideAutocompleteDropdown();
                }
            });
    
            // Add keydown event listener to the document
            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape') {
                    hideAutocompleteDropdown();
                }
            });
    
            // Existing click event listener
            document.addEventListener('click', function(event) {
                if (!autocompleteDropdown.contains(event.target) && event.target !== userInput) {
                    hideAutocompleteDropdown();
                }
            });
        }

        var dropdownToggle = document.querySelector('#moduleDropdown');
        var dropdownMenu = document.querySelector('.dropdown-menu');
        var dropdownItems = document.querySelectorAll('.dropdown-item');
        console.log("Dropdown toggle found:", !!dropdownToggle);
        console.log("Dropdown menu found:", !!dropdownMenu);
        console.log("Number of dropdown items:", dropdownItems.length);
        
        if (!dropdownToggle || !dropdownMenu) {
            console.error("Dropdown elements not found!");
            return;
        }

        dropdownToggle.addEventListener('click', function(event) {
            console.log("Dropdown toggle clicked");
            event.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        dropdownItems.forEach(function(item) {
            item.addEventListener('click', function(event) {
                console.log("Dropdown item clicked:", this.textContent);
                event.preventDefault();
                event.stopPropagation();
                dropdownToggle.textContent = this.textContent;
                dropdownMenu.classList.remove('show');
            });
        });
    
        document.addEventListener('click', function(event) {
            if (!dropdownMenu.contains(event.target) && !dropdownToggle.contains(event.target)) {
                dropdownMenu.classList.remove('show');
            }
        });

        const sendButton = document.getElementById('send-button');
        if (userInput) {
            userInput.addEventListener('focus', function() {
                var bsDropdown = bootstrap.Dropdown.getInstance(dropdownMenu);
                if (bsDropdown) {
                    bsDropdown.hide();
                }
            });
        }
        if (userInput && sendButton) {
            userInput.addEventListener('keypress', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    sendMessage(event);
                    hideAutocompleteDropdown();
                }
            });
    
            sendButton.addEventListener('click', sendMessage);
            sendButton.addEventListener('touchstart', function (event) {
                event.preventDefault();
                sendMessage(event);
                hideAutocompleteDropdown();

            });
        } else {
            console.error('User input or send button not found');
        }

        var calendlyModalElement = document.getElementById('calendlyModal');
        var bookReviewBtn = document.getElementById('book-review-btn');
        var reviewBanner = document.getElementById('review-banner');
        const requestReviewBtn = document.getElementById('request-review-btn');

        if (calendlyModalElement && bookReviewBtn && reviewBanner) {
            // We're on the chat page, set up the banner behavior
            document.body.classList.add('chat-page');

            var calendlyModal = new bootstrap.Modal(calendlyModalElement);

            // Show/hide banner on scroll
            let lastScrollTop = 0;
            window.addEventListener('scroll', function () {
                let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                if (scrollTop > lastScrollTop) {
                    reviewBanner.classList.add('hidden');
                } else {
                    reviewBanner.classList.remove('hidden');
                }
                lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
            }, false);

            // Open Calendly modal when "Book Now" is clicked
            bookReviewBtn.addEventListener('click', function () {
                calendlyModal.show();
            });

            // Existing modal event listener
            calendlyModalElement.addEventListener('hidden.bs.modal', function () {
                document.body.classList.remove('modal-open');
                var modalBackdrop = document.querySelector('.modal-backdrop');
                if (modalBackdrop) {
                    modalBackdrop.remove();
                }
            });
        }
        });

    async function getCurrentUserId() {
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

    function appendLoader() {
        const loaderElement = document.createElement('div');
        loaderElement.classList.add('chat-bubble', 'assistant', 'loader-container');
        
        const loader = document.createElement('div');
        loader.classList.add('mongodb-loader');
        
        loaderElement.appendChild(loader);
        chatContainer.appendChild(loaderElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return loaderElement;
    }

    function removeLoader(loaderElement) {
        if (loaderElement && loaderElement.parentNode) {
            loaderElement.parentNode.removeChild(loaderElement);
        }
    }

    function escapeSpecialChars(str) {
        return str.replace(/[&<>'"]/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[char] || char;
        });
    }

    function showFeedbackPopup() {
        // Implement this function based on your feedback UI
        console.log('Feedback popup shown');
    }

    function appendFeedbackButtons(messageElement, data) {
        console.log('Appending feedback buttons with data:', data);
        if (!data || !data.question_id) {
            console.error('Invalid data for feedback buttons:', data);
            return;
        }
        messageElement.setAttribute('data-question-id', data.question_id);
        messageElement.setAttribute('data-original-question', data.original_question || '');    
    
        const feedbackContainer = document.createElement('div');
        feedbackContainer.classList.add('feedback-container');
    
        const helpfulText = document.createElement('span');
        helpfulText.textContent = 'Is this helpful?';
        helpfulText.classList.add('feedback-text');
        feedbackContainer.appendChild(helpfulText);
    
        const positiveButton = document.createElement('button');
        positiveButton.innerHTML = '👍';
        positiveButton.classList.add('feedback-icon', 'thumbs-up');
        positiveButton.onclick = () => provideFeedback(data.question_id, true);
    
        const negativeButton = document.createElement('button');
        negativeButton.innerHTML = '👎';
        negativeButton.classList.add('feedback-icon', 'thumbs-down');
        negativeButton.onclick = () => provideFeedback(data.question_id, false);
    
        feedbackContainer.appendChild(positiveButton);
        feedbackContainer.appendChild(negativeButton);
        messageElement.appendChild(feedbackContainer);
    }
    function generateUniqueId() {
        return 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    function provideFeedback(questionId, isPositive) {
        const csrfToken = getCsrfToken();
        if (!csrfToken) {
            showError('CSRF token not available. Please refresh the page and try again.');
            return;
        }
        const messageElement = document.querySelector(`[data-question-id="${questionId}"]`);
        if (!messageElement) {
            console.error('Message element not found');
            return;
        }
        const originalQuestion = messageElement.getAttribute('data-original-question');
        const proposedAnswer = messageElement.textContent;
    
        console.log('Sending feedback:', { questionId, isPositive, originalQuestion, proposedAnswer });
        
        const feedbackData = {
            is_positive: isPositive,
            question_id: questionId,
            original_question: originalQuestion,
            proposed_answer: proposedAnswer
        };
    
        fetch('/api/message_feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(feedbackData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Message feedback response:', data);
            // Handle success (e.g., update UI to show feedback was received)
        })
        .catch(error => {
            console.error('Error submitting message feedback:', error);
            showError(`Error submitting message feedback: ${error.message}`);
        });
    }

    function hideAutocompleteDropdown() {
        const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
        if (autocompleteDropdown) {
            autocompleteDropdown.style.display = 'none';
        }
    }

    async function sendMessage(event, presetMessage = null) {
        const userInput = document.getElementById('user-input');
        const moduleSelect = document.getElementById('moduleDropdown');
        const message = presetMessage || userInput.value.trim();
        let selectedModule = moduleSelect.textContent.trim();
        const loader = appendLoader();

        if (selectedModule.toLowerCase() === "select a module") {
            selectedModule = "";
        }
    
        if ((message.startsWith('/') || chatState.waitingForConnectionString)) {
            userInput.value = '';
            removeLoader(loader);
            hideAutocompleteDropdown();
            handleCommand(message);
            return;
        }
        if (message) {
            hideAutocompleteDropdown();  // Hide autocomplete dropdown
            appendMessage('User', message);
            userInput.value = '';
            var bsDropdown = bootstrap.Dropdown.getInstance(bsDropdown);
            console.log("dropdown: ", bsDropdown)
            if (bsDropdown) {
                bsDropdown.hide();
            }
    
            try {
                const userId = await getCurrentUserId();
                if (!userId) {
                    // If getUserId returned null, the redirect to login should have already happened
                    return;
                }
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include', // This ensures cookies are sent with the request
                    body: JSON.stringify({
                        question: message,
                        conversation_id: currentConversationId,
                        module: selectedModule
                    })
                });
                if (!response.ok) {
                    const errorMessage = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
                }

                const data = await response.json();

                if (data.conversation_id) {
                    currentConversationId = data.conversation_id;
                }

                if (data.answer) {
                    appendMessage('Assistant', data.answer, {
                        ...data,
                        question_id: data.question_id || '',
                        original_question: message
                    });
                } else {
                    appendMessage('Assistant', 'I couldn\'t find an answer to your question.');
                }
            } catch (error) {
                console.error('Error in sendMessage:', error);
                appendMessage('Assistant', `Error: ${error.message}`);
            } finally {
                removeLoader(loader);
            }
        }
    }
    function generateQuestionId(data) {
        // Use a combination of properties to create a unique ID
        return btoa(data.question).slice(0, 10);  // Base64 encode the question and take first 10 characters
    }

    function appendMessage(sender, message, data = null) {
        if (!chatContainer) {
            console.error('Chat container not available. Message not appended.');
            return;
        }
        if (message.startsWith('mongodb://') || message.startsWith('mongodb+srv://')) {
            chatState.waitingForConnectionString = false;
            saveChatState();
            hideAutocompleteDropdown();
            checkConnection(message);
            removeLoader(loader);
            hideWorkflowIndicator();
            return;
        }
        console.log(`Appending message from ${sender}:`, message);
    
        const messageId = generateUniqueId();
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-bubble', sender.toLowerCase());
        messageElement.id = messageId;
    
        if (sender.toLowerCase() === 'assistant') {
            if (message.includes('<')) {
                messageElement.innerHTML = message;
            } else {
                const bubbleContent = document.createElement('div');
                bubbleContent.classList.add('bubble-content');
                bubbleContent.innerHTML = marked.parse(escapeSpecialChars(message));
                messageElement.appendChild(bubbleContent);
            }
        // Check if we are waiting for a connection string confirmation
        if (chatState.waitingForConnectionStringConfirmation) {
            const buttonContainer = document.createElement('div');
            buttonContainer.classList.add('confirmation-buttons');
            
            const yesButton = document.createElement('button');
            yesButton.textContent = 'Yes';
            yesButton.classList.add('btn', 'btn-success', 'mr-2');
            yesButton.onclick = () => handleConnectionStringConfirmation('yes');
            
            const noButton = document.createElement('button');
            noButton.textContent = 'No';
            noButton.classList.add('btn', 'btn-danger');
            noButton.onclick = () => handleConnectionStringConfirmation('no');
            
            buttonContainer.appendChild(yesButton);
            buttonContainer.appendChild(noButton);
            messageElement.appendChild(buttonContainer);
        }
            // Create and append the source element
            const sourceElement = document.createElement('div');
            sourceElement.classList.add('source-info');
            
            if (data && data.source === 'LLM') {
                sourceElement.textContent = 'Source: Generated by LLM';
            } else if (data && data.source === 'database') {
                const scoreText = data.score ? ` (Match score: ${data.score.toFixed(4)})` : '';
                sourceElement.textContent = `Source: From previous response${scoreText}`;
            } else {
                sourceElement.textContent = 'Source: Assistant';
            }
            messageElement.appendChild(sourceElement);
    
            if (data && data.debug_info) {
                const debugAccordion = document.createElement('div');
                debugAccordion.className = 'debug-accordion';
                debugAccordion.innerHTML = `
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#debugInfo${messageId}" aria-expanded="false" aria-controls="debugInfo${messageId}">
                        Debug Info
                    </button>
                    <div id="debugInfo${messageId}" class="accordion-collapse collapse">
                        <div class="accordion-body">
                            <pre id="debugContent${messageId}"></pre>
                        </div>
                    </div>
                `;
                messageElement.appendChild(debugAccordion);
    
                // Format debug info, removing embedding fields
                const formattedDebugInfo = JSON.parse(JSON.stringify(data.debug_info));
                if (formattedDebugInfo.similar_questions) {
                    formattedDebugInfo.similar_questions = formattedDebugInfo.similar_questions.map(q => {
                        const { question_embedding, ...rest } = q;
                        return rest;
                    });
                }
    
                setTimeout(() => {
                    const debugContentElement = document.getElementById(`debugContent${messageId}`);
                    if (debugContentElement) {
                        debugContentElement.textContent = JSON.stringify(formattedDebugInfo, null, 2);
                    }
                }, 0);
            }
    
            // Append feedback buttons if data is available
            if (data) {
                const feedbackData = {
                    question_id: data.question_id || generateQuestionId(data),
                    original_question: data.original_question || ''
                };
                appendFeedbackButtons(messageElement, feedbackData);
            }
        } else {
            const span = document.createElement('span');
            span.textContent = escapeSpecialChars(message);
            messageElement.appendChild(span);
        }
    
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
            // Add a small delay to force the browser to render everything together
    if (chatState.waitingForConnectionStringConfirmation) {
        setTimeout(() => {
            const buttonContainer = messageElement.querySelector('.confirmation-buttons');
            if (buttonContainer) {
                buttonContainer.style.display = 'flex';
            }
        }, 0); // You can tweak this delay as needed
    }
    }
 
    function submitAppFeedback(rating) {
        fetch('/api/app_feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ rating: rating })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Application feedback submitted:', data);
            // Handle success (e.g., show a thank you message)
        })
        .catch(error => {
            console.error('Error submitting application feedback:', error);
            // Handle error
        });
    }
    /**
 * Displays an error message to the user.
 * @param {string} message - The error message to display.
 * @param {string} [elementId] - The ID of the element where the error should be displayed. If not provided, a default location is used.
 */
function showError(message, elementId = 'error-container') {
    // Log the error to the console for debugging
    console.error(message);

    // Find the container where the error message will be displayed
    const errorContainer = document.getElementById(elementId);

    if (errorContainer) {
        // Create a new error message element
        const errorElement = document.createElement('div');
        errorElement.className = 'alert alert-danger alert-dismissible fade show';
        errorElement.role = 'alert';
        errorElement.innerHTML = `
            <strong>Error:</strong> ${escapeHTML(message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        // Add the error message to the container
        errorContainer.appendChild(errorElement);

        // Optionally, scroll to the error message
        errorContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Automatically remove the error message after a certain time (e.g., 5 seconds)
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    } else {
        // If the specified container doesn't exist, fall back to an alert
        alert(`Error: ${message}`);
    }
}

// Escape HTML special characters in a string
function escapeHTML(str) {
    if (typeof str !== 'string') {
        console.warn('escapeHTML received a non-string value:', str);
        return '';
    }
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function unescapeHTML(str) {
    if (typeof str !== 'string') {
        console.warn('unescapeHTML received a non-string value:', str);
        return '';
    }
    return str.replace(/&amp;|&lt;|&gt;|&#39;|&quot;/g, tag => ({
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&#39;': "'",
        '&quot;': '"'
    }[tag] || tag));
}
function getCsrfToken() {
    const tokenElement = document.querySelector('meta[name="csrf-token"]');
    if (tokenElement) {
        return tokenElement.getAttribute('content');
    } else {
        console.error('CSRF token not found. Ensure the meta tag is present in the HTML.');
        return null;
    }
}

function handleCommand(command) {
    const [baseCommand, ...args] = command.split(' ');
    const action = args.join(' ').toLowerCase();
    appendMessage('User', baseCommand);

    switch (baseCommand.toLowerCase()) {
        case '/help':
        case '/h':
            showHelpInformation();
            break;
        case '/check':
        case '/c':
            if (action.toLowerCase() === 'connection') {
                checkConnection();
            }
            break;
        case '/load':
        case '/l':
            if (action.toLowerCase() === 'data') {
                loadData();
            }
            break;
        case '/add':
        case '/a':
            if (action.toLowerCase() === 'vectors') {
                addVectors();
            }
            break;
        case '/mongo':
        case '/m':
            executeMongoShellCommand(command);
            break;
        default:
            appendMessage('Assistant', 'Invalid command. Please check the available commands.');
    }
}

async function executeMongoShellCommand(command) {
    try {
        const response = await fetch('/api/mongodb_shell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ command })
        });

        const data = await response.json();
        if (data.success) {
            appendMessage('Assistant', `<pre>${data.result}</pre>`);
        } else {
            appendMessage('Assistant', `<pre style="color: red;">${data.message}</pre>`);
        }
    } catch (error) {
        appendMessage('Assistant', 'There was an error processing your MongoDB command.');
        console.error('Error in executeMongoShellCommand:', error);
    }
}

function handleConnectionStringConfirmation(response) {
    chatState.waitingForConnectionStringConfirmation = false;

    if (response.toLowerCase() === 'yes') {
        if (chatState.loadDataPending) {
            loadData(chatState.storedConnectionString);
        } else if (chatState.addVectorsPending) {
            appendMessage('Assistant', "Great! Now, please specify the provider (serverless, vertex, openai, or sagemaker).");
            chatState.waitingForProviderInput = true;
        } else {
            checkConnection(chatState.storedConnectionString);
        }
    } else {
        if (chatState.loadDataPending) {
            appendMessage('Assistant', "Alright, please enter your MongoDB connection string manually to load data.");
        } else if (chatState.addVectorsPending) {
            appendMessage('Assistant', "Alright, please enter your MongoDB connection string manually to add vectors. Also, specify the provider (serverless, vertex, openai, or sagemaker).");
        } else {
            appendMessage('Assistant', "Alright, please enter your MongoDB connection string manually.");
        }
        chatState.waitingForConnectionString = true;
    }

    if (response.toLowerCase() === 'no') {
        chatState.storedConnectionString = null;
    }
    
    saveChatState();
}

function handleProviderInput(command) {
    const provider = command.trim().toLowerCase();
    if (['serverless', 'vertex', 'openai', 'sagemaker'].includes(provider)) {
        addVectors(chatState.storedConnectionString, provider);
        chatState.waitingForProviderInput = false;
        chatState.addVectorsPending = false;
        chatState.storedConnectionString = null;
        saveChatState();
    } else {
        appendMessage('Assistant', "Invalid provider. Please specify either serverless, vertex, openai, or sagemaker.");
    }
}

function handleConnectionStringInput(command) {
    if (command.startsWith('mongodb://') || command.startsWith('mongodb+srv://')) {
        if (chatState.loadDataPending) {
            loadData(command);
            chatState.loadDataPending = false;
        } else if (chatState.addVectorsPending) {
            appendMessage('Assistant', "Connection string received. Now, please specify the provider (serverless, vertex, openai, or sagemaker).");
            chatState.waitingForProviderInput = true;
            chatState.storedConnectionString = command;
        } else {
            checkConnection(command);
        }
        chatState.waitingForConnectionString = false;
        saveChatState();
        hideWorkflowIndicator();
    } else if (command.toLowerCase() === '/cancel') {
        resetConnectionStringWaiting();
        hideWorkflowIndicator();
        appendMessage('Assistant', "Operation cancelled. How else can I assist you?");
    } else {
        appendMessage('Assistant', "That doesn't look like a valid MongoDB connection string. Please make sure it starts with 'mongodb://' or 'mongodb+srv://'. Try again or type '/cancel' to cancel the operation.");
    }
}

function showHelpInformation() {
    const helpMessage = `
        <h4>Welcome to the AI Lab Assistant!</h4>
        <p>Here are some tips on how to use this chat system:</p>
        <ul>
            <li>Ask clear, specific questions about MongoDB, its features, or best practices.</li>
            <li>You can ask follow-up questions to get more detailed information.</li>
            <li>If you need to see code examples, just ask!</li>
        </ul>
        <h5>Available Commands:</h5>
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>Command</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>/help or /h</td>
                    <td>Show this help information</td>
                </tr>
                <tr>
                    <td>/check or /c connection</td>
                    <td>Test a MongoDB connection string</td>
                </tr>
                <tr>
                    <td>/load or /l data</td>
                    <td>Start the data loading process</td>
                </tr>
                <tr>
                    <td>/add or /a vectors</td>
                    <td>Add vectors to your library database</td>
                </tr>
            </tbody>
        </table>
        <p>Feel free to ask if you need any clarification or have more questions!</p>
    `;

    appendMessage('Assistant', helpMessage);
}

// Function to load chat state from localStorage
function loadChatState() {
    const savedState = localStorage.getItem('chatState');
    if (savedState) {
        return JSON.parse(savedState);
    }
    return {
        waitingForConnectionString: false,
        currentModule: null
    };
}

function resetConnectionStringWaiting() {
    chatState.waitingForConnectionString = false;
    chatState.waitingForConnectionStringConfirmation = false;
    chatState.waitingForProviderInput = false;
    chatState.loadDataPending = false;
    chatState.addVectorsPending = false;
    chatState.storedConnectionString = null;
    saveChatState();
}

function saveChatState() {
    localStorage.setItem('chatState', JSON.stringify(chatState));
}

async function checkConnectionString() {
    try {
        const response = await fetch('/api/user_profile');
        const profileData = await response.json();
        
        if (profileData.atlas_connection_string) {
            chatState.storedConnectionString = profileData.atlas_connection_string; // Store the full connection string
            const sanitizedConnectionString = sanitizeConnectionString(chatState.storedConnectionString); // Sanitize for display
            
            chatState.waitingForConnectionStringConfirmation = true;
            appendMessage('Assistant', `I found a connection string stored in your profile. The sanitized version is: ${sanitizedConnectionString}. Would you like to use it?`);
        } else {
            const profileLink = '<a href="/profile" target="_blank">profile settings</a>';
            appendMessage('Assistant', `I couldn't find a connection string in your profile. You can add one in your ${profileLink}. For now, please enter your MongoDB connection string manually. (Don't worry, it will be handled securely and won't be stored.)`);
            chatState.waitingForConnectionString = true;
        }
        saveChatState();
        showWorkflowIndicator("Waiting for connection string...");
    } catch (error) {
        console.error('Error fetching user profile:', error);
        appendMessage('Assistant', "There was an error retrieving your profile information. Please enter your MongoDB connection string manually.");
        chatState.waitingForConnectionString = true;
        saveChatState();
        showWorkflowIndicator("Waiting for connection string...");
    }
}

function sanitizeConnectionString(connectionString) {
    // This function will hide sensitive parts of the connection string
    const urlObj = new URL(connectionString);
    if (urlObj.password) {
        urlObj.password = '****';
    }
    return urlObj.toString();
}

async function checkConnection() {
    try {
        const response = await fetch('/api/check_connection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include' // Ensure cookies are sent with the request
        });

        const data = await response.json();
        if (!data.success) {
            appendMessage('Assistant', data.message);
            //appendMessage('User', 'How can I update the firewall in Atlas to enable connections from anywhere?');
            sendMessage(null,'How can I update the firewall in Atlas to enable connections from anywhere?' );
        } else {
            let databaseInfoMessage = formatDatabaseInfo(data.database_info);
            appendMessage('Assistant', `Connection successful: ${data.message}\n${databaseInfoMessage}`);
            // Handle additional database info display if needed
        }
    } catch (error) {
        appendMessage('Assistant', 'There was an error processing your request.');
        console.error('Error in checkConnection:', error);
    }
}

function formatDatabaseInfo(databaseInfo) {
    if (!databaseInfo || Object.keys(databaseInfo).length === 0) {
        return "No database information available.";
    }

    let formattedInfo = "Database Information:\n";
    for (const [collectionName, collectionInfo] of Object.entries(databaseInfo)) {
        formattedInfo += `\nCollection: ${collectionName}\n`;
        formattedInfo += `Documents: ${collectionInfo.document_count}\n`;

        if (collectionInfo.indexes && collectionInfo.indexes.length > 0) {
            formattedInfo += `Indexes:\n`;
            collectionInfo.indexes.forEach(index => {
                formattedInfo += `  - ${index.name}: ${JSON.stringify(index.keys)}${index.unique ? ' (unique)' : ''}\n`;
            });
        } else {
            formattedInfo += `No indexes found.\n`;
        }
    }

    return formattedInfo;
}

function showModuleSelectionPopup() {
    const availableModules = [
        'Atlas Setup', 'Data Modeling', 'Aggregation Framework',
        'Atlas Search', 'Atlas Vector Search', 'AI / RAG', 'Library Management Application'
    ];

    let modalContent = `
    <div class="modal fade" id="moduleSelectionModal" tabindex="-1" aria-labelledby="moduleSelectionModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header" style="background-color: #343a40; color: #ffffff;">
                    <h5 class="modal-title" id="moduleSelectionModalLabel" style="font-weight: bold; font-size: 1.25rem;">Select a Module</h5>

                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">`;

    availableModules.forEach(module => {
        modalContent += `<button type="button" class="btn btn-primary module-btn" data-module="${module}">${module}</button><br/>`;
    });

    modalContent += `
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalContent);

    const modalElement = new bootstrap.Modal(document.getElementById('moduleSelectionModal'));
    modalElement.show();

    document.querySelectorAll('.module-btn').forEach(button => {
        button.addEventListener('click', function() {
            const selectedModule = this.getAttribute('data-module');
            startModule(selectedModule);
            modalElement.hide();
        });
    });

    document.getElementById('moduleSelectionModal').addEventListener('hidden.bs.modal', function () {
        this.remove(); // Clean up the modal after it's closed
    });
}
// Load data functions

async function handleLoadDataCommand() {
    try {
        const response = await fetch('/api/user_profile');
        const profileData = await response.json();
        
        if (profileData.atlas_connection_string) {
            chatState.storedConnectionString = profileData.atlas_connection_string; // Store the full connection string
            const sanitizedConnectionString = sanitizeConnectionString(chatState.storedConnectionString); // Sanitize for display
            
            chatState.waitingForConnectionStringConfirmation = true;
            chatState.loadDataPending = true;
            appendMessage('Assistant', `I found a connection string stored in your profile. The sanitized version is: ${sanitizedConnectionString}. Would you like to use it for loading data?`);
        } else {
            const profileLink = '<a href="/profile" target="_blank">profile settings</a>';
            appendMessage('Assistant', `I couldn't find a connection string in your profile. You can add one in your ${profileLink}. For now, please enter your MongoDB connection string to load data. (Don't worry, it will be handled securely and won't be stored.)`);
            chatState.waitingForConnectionString = true;
            chatState.loadDataPending = true;
        }
        saveChatState();
        showWorkflowIndicator("Waiting for connection string to load data...");
    } catch (error) {
        console.error('Error fetching user profile:', error);
        appendMessage('Assistant', "There was an error retrieving your profile information. Please enter your MongoDB connection string manually to load data.");
        chatState.waitingForConnectionString = true;
        chatState.loadDataPending = true;
        saveChatState();
        showWorkflowIndicator("Waiting for connection string to load data...");
    }
}

async function handleAddVectorsCommand() {
    try {
        const response = await fetch('/api/user_profile');
        const profileData = await response.json();
        
        if (profileData.atlas_connection_string) {
            chatState.storedConnectionString = profileData.atlas_connection_string; // Store the full connection string
            const sanitizedConnectionString = sanitizeConnectionString(chatState.storedConnectionString); // Sanitize for display
            
            chatState.waitingForConnectionStringConfirmation = true;
            chatState.addVectorsPending = true;
            appendMessage('Assistant', `I found a connection string stored in your profile. The sanitized version is: ${sanitizedConnectionString}. Would you like to use it for adding vectors?`);
        } else {
            const profileLink = '<a href="/profile" target="_blank">profile settings</a>';
            appendMessage('Assistant', `I couldn't find a connection string in your profile. You can add one in your ${profileLink}. For now, please enter your MongoDB connection string to add vectors. (Don't worry, it will be handled securely and won't be stored.)`);
            chatState.waitingForConnectionString = true;
            chatState.addVectorsPending = true;
        }
        saveChatState();
        showWorkflowIndicator("Waiting for connection string to add vectors...");
    } catch (error) {
        console.error('Error fetching user profile:', error);
        appendMessage('Assistant', "There was an error retrieving your profile information. Please enter your MongoDB connection string manually to add vectors.");
        chatState.waitingForConnectionString = true;
        chatState.addVectorsPending = true;
        saveChatState();
        showWorkflowIndicator("Waiting for connection string to add vectors...");
    }
}

async function loadData(connectionString) {
    appendMessage('Assistant', "Starting data import process...");
    try {
        const response = await fetch('/api/load_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ connectionString: connectionString })
        });
        const data = await response.json();
        if (data.success) {
            appendMessage('Assistant', "Data import process has been initiated. You'll see updates here as the process progresses.");
        } else {
            appendMessage('Assistant', `Error starting data import: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        appendMessage('Assistant', "Sorry, there was an error starting the data import process. Please try again later.");
    }
    chatState.loadDataPending = false;
    saveChatState();
}

async function addVectors(connectionString, provider) {
    appendMessage('Assistant', "Starting vector addition process...");
    try {
        const response = await fetch('/api/add_vectors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ connectionString: connectionString, provider: provider })
        });
        const data = await response.json();
        if (data.success) {
            appendMessage('Assistant', "Vector addition process has been initiated. You'll see updates here as the process progresses.");
        } else {
            appendMessage('Assistant', `Error starting vector addition: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        appendMessage('Assistant', "Sorry, there was an error starting the vector addition process. Please try again later.");
    }
    chatState.addVectorsPending = false;
    saveChatState();
    hideWorkflowIndicator();
}

// load data stuff

// Add socket.io connection for real-time updates
const socket = io();

socket.on('connect', function() {
    console.log('Connected to server');
});

socket.on('message', (data) => {
    appendMessage('Assistant', data.message);
});

socket.on('status', (data) => {
    appendMessage('Assistant', `${data.collection}: ${data.count}/${data.total} documents imported`);
});

socket.on('import-complete', (data) => {
    appendMessage('Assistant', data.message);
    hideWorkflowIndicator();

});

socket.on('vector-data-complete', (data) => {
    appendMessage('Assistant', data.message);
    hideWorkflowIndicator();
});

function showWorkflowIndicator(message) {
    const indicator = document.getElementById('workflow-indicator');
    const messageSpan = document.getElementById('workflow-message');
    messageSpan.textContent = message;
    indicator.style.display = 'flex';
    indicator.style.opacity = '0';
    setTimeout(() => {
        indicator.style.transition = 'opacity 0.3s ease-in-out';
        indicator.style.opacity = '1';
    }, 10);
}

function hideWorkflowIndicator() {
    const indicator = document.getElementById('workflow-indicator');
    indicator.style.opacity = '0';
    setTimeout(() => {
        indicator.style.display = 'none';
    }, 300);
}
document.getElementById('user-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});

})();