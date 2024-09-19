(function () {
    let chatContainer;
    let currentConversationId = null;
    let currentFocus = -1;
    let chatState;
    let isSending = false;
    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            sendMessage(event);
        }
    }
    function removePreviousEventListeners(element, eventType) {
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        return newElement;
    }
    function setupEventListeners() {
        const sendButton = document.getElementById('send-button');
        const userInput = document.getElementById('user-input');
    
        if (sendButton && userInput) {
            sendButton.addEventListener('click', function(event) {
                event.preventDefault();
                sendMessage(event);
            });
    
            userInput.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    sendMessage(event);
                }
            });
        } else {
            console.error('Send button or user input element not found');
        }
    }
    
    // Call this function when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', setupEventListeners);
    const LoaderManager = (function () {
        let loaderElement = null;
        let isLoading = false;
    
        return {
            showLoader: function (chatContainer) {
                if (isLoading) {
                    console.log("Loader is already being shown, skipping.");
                    return;
                }
                isLoading = true;
    
                if (this.isLoaderActive()) {
                    console.log("Loader already exists, skipping append.");
                    return;
                }
    
                loaderElement = document.createElement('div');
                loaderElement.classList.add('chat-bubble', 'loader-container');
    
                const loader = document.createElement('div');
                loader.classList.add('mongodb-loader');
    
                loaderElement.appendChild(loader);
                chatContainer.appendChild(loaderElement);
                chatContainer.scrollTop = chatContainer.scrollHeight;
    
                console.log("Loader appended", loaderElement);
            },
    
            hideLoader: function () {
                if (this.isLoaderActive()) {
                    loaderElement.parentNode.removeChild(loaderElement);
                    console.log("Loader removed");
                    loaderElement = null;
                } else {
                    console.log("No active loader to remove.");
                }
                isLoading = false;
            },
    
            isLoaderActive: function () {
                return loaderElement !== null;
            }
        };
    })();


    document.addEventListener('DOMContentLoaded', function () {

        console.log("DOM fully loaded");
        chatState = loadChatState();
        console.log("Initial chat state:", chatState);

        // Clear existing listeners before adding new ones
        if (typeof bootstrap === 'undefined') {
            console.error('Bootstrap is not loaded. Please check your script loading order.');
            appendMessage('Assistant', 'An internal error occurred. Please refresh the page.');
            return;
        } else {
            console.log('Bootstrap is loaded successfully.');
        }

        // Initialize chatContainer
        chatContainer = document.getElementById('chat-container');
        if (!chatContainer) {
            console.error('Chat container not found');
            return;
        }

        document.getElementById('cancel-workflow').addEventListener('click', function () {
            chatState.waitingForConnectionString = false;
            chatState.loadDataPending = false;
            saveChatState();
            hideWorkflowIndicator();
            appendMessage('Assistant', "Workflow cancelled. How else can I assist you?");
        });

        const autocompleteDropdown = document.getElementById('autocomplete-dropdown');

        if (autocompleteDropdown) {
            autocompleteDropdown.addEventListener('click', function (event) {
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

        if (userInput && autocompleteDropdown) {
            // Add keydown event listener to the user input
            userInput.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') {
                    hideAutocompleteDropdown();
                }
            });
            // Existing click event listener
            document.addEventListener('click', function (event) {
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

        dropdownToggle.addEventListener('click', function (event) {
            console.log("Dropdown toggle clicked");
            event.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        dropdownItems.forEach(function (item) {
            item.addEventListener('click', function (event) {
                console.log("Dropdown item clicked:", this.textContent);
                event.preventDefault();
                event.stopPropagation();
                dropdownToggle.textContent = this.textContent;
                dropdownMenu.classList.remove('show');
            });
        });

        document.addEventListener('click', function (event) {
            if (!dropdownMenu.contains(event.target) && !dropdownToggle.contains(event.target)) {
                dropdownMenu.classList.remove('show');
            }
        });

        const sendButton = document.getElementById('send-button');
        if (userInput) {
            userInput.addEventListener('focus', function () {
                var bsDropdown = bootstrap.Dropdown.getInstance(dropdownMenu);
                if (bsDropdown) {
                    bsDropdown.hide();
                }
            });
        }
        if (sendButton && userInput) {
            // Define the handleKeyDown function for the Enter key
            function handleKeyDown(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();  // Prevent form submission or default behavior
                    sendMessage(event);  // Call the sendMessage function when Enter is pressed
                }
            }
    
            // Add click listener to the send button
            sendButton.addEventListener('click', function (event) {
                sendMessage(event);
            });
    
            // Add keydown listener to the input field to capture the Enter key
            userInput.addEventListener('keydown', handleKeyDown);
        } else {
            console.error('Send button or user input element not found');
        }

        var reviewBanner = document.getElementById('review-banner');
        const requestReviewBtn = document.getElementById('request-review-btn');

        var formModalElement = document.getElementById('formModal');
        if (formModalElement) {
            var formModal = new bootstrap.Modal(formModalElement);

            // Event listener for opening the modal
            var bookReviewBtn = document.getElementById('book-review-btn');
            bookReviewBtn.addEventListener('click', function () {
                formModal.show();
            });
        } else {
            console.error('Modal element not found');
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
        return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
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

/**
 * Sends a message to the chat API and handles the response.
 * This function manages the chat state, displays loaders, and updates the UI with the response.
 * It prevents concurrent sendings and ensures proper error handling.
 *
 * @param {Event} event - The event that triggered the function (optional)
 * @param {string} presetMessage - A preset message to send instead of the user input (optional)
 * @returns {Promise<void>}
 */
    /**
 * Sends a message to the chat API and handles the response.
 * This function manages the chat state, displays loaders, and updates the UI with the response.
 * It prevents concurrent sendings and ensures proper error handling.
 *
 * @param {Event} event - The event that triggered the function (optional)
 * @param {string} presetMessage - A preset message to send instead of the user input (optional)
 * @returns {Promise<void>}
 */
async function sendMessage(event, presetMessage = null) {
    if (isSending) {
        console.log("sendMessage is already in progress, skipping");
        return;
    }
    isSending = true;

    const userInput = document.getElementById('user-input');
    const moduleSelect = document.getElementById('moduleDropdown');

    if (!userInput || !moduleSelect) {
        console.error('Required elements not found in the DOM');
        isSending = false;
        return;
    }

    const message = presetMessage || userInput.value.trim();
    let selectedModule = moduleSelect.textContent.trim();

    if (selectedModule.toLowerCase() === "select a module") {
        selectedModule = "";
    }

    try {
        if (message.startsWith('/') || chatState.waitingForConnectionString) {
            userInput.value = '';
            hideAutocompleteDropdown();
            await handleCommand(message);
            return;
        }

        if (!message) {
            console.log("No message to send");
            return;
        }

        hideAutocompleteDropdown();
        appendMessage('User', message);
        userInput.value = '';
        LoaderManager.showLoader(chatContainer);

        const userId = await getCurrentUserId();
        if (!userId) {
            console.log("User ID not available, possibly not logged in");
            return;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
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
                original_question: message,
                related_concepts: data.related_concepts || []
            });
        } else {
            appendMessage('Assistant', 'I couldn\'t find an answer to your question.');
        }

    } catch (error) {
        console.error('Error in sendMessage:', error);
        appendMessage('Assistant', `Error: ${error.message}`);
    } finally {
        isSending = false;
        LoaderManager.hideLoader();
    }
}

    function generateQuestionId(data) {
        // Use a combination of properties to create a unique ID
        return btoa(data.question).slice(0, 10);  // Base64 encode the question and take first 10 characters
    }

    async function appendMessage(sender, message, data = null) {
        if (!chatContainer) {
            console.warn('Chat container not available. Message not appended.');
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
            // Create and append the source element
            const sourceElement = document.createElement('div');
            sourceElement.classList.add('source-info');
            const userId = await getCurrentUserId();
            if (!userId) {
                console.log("User ID not available, possibly not logged in");
                return;
            }            console.log("User: " , userId);
            if (data && data.source === 'LLM') {
                sourceElement.textContent = 'Source: Generated by LLM';
                logMetrics('LLM', 'Assistant', userId);
            } else if (data && data.source === 'database') {
                const scoreText = data.score ? ` (Match score: ${data.score.toFixed(4)})` : '';
                sourceElement.textContent = `Source: From previous response${scoreText}`;
                logMetrics('vector_search', 'Assistant', userId);
            } else {
                sourceElement.textContent = 'Source: Assistant';
            }
            messageElement.appendChild(sourceElement);
            if (data && data.related_concepts && data.related_concepts.length > 0) {
                const relatedConceptsElement = document.createElement('div');
                relatedConceptsElement.classList.add('related-concepts-container');

                const accordionId = `accordion-${messageId}`;
                const collapseId = `collapse-${messageId}`;

                relatedConceptsElement.innerHTML = `
                    <div class="accordion" id="${accordionId}">
                        <div class="accordion-item">
                            <h2 class="accordion-header" id="heading-${messageId}">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                                    Related Concepts
                                </button>
                            </h2>
                            <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="heading-${messageId}" data-bs-parent="#${accordionId}">
                                <div class="accordion-body">
                                    <div id="graph-${messageId}" class="knowledge-graph" style="width: 100%; height: 300px;"></div>
                                    <ul>
                                        ${data.related_concepts.map((concept, index) => `
                                            <li>
                                                <a href="#" class="related-concept-link" data-concept="${escapeHTML(concept.concept)}">
                                                    <strong>${escapeHTML(concept.concept)}</strong>
                                                </a>: 
                                                <span class="description-preview">${escapeHTML(concept.description.substring(0, 100))}...</span>
                                                <div class="description-full" style="display: none;">
                                                    ${escapeHTML(concept.description)}
                                                </div>
                                                <button class="toggle-description" data-target="${index}">Show More</button>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                messageElement.appendChild(relatedConceptsElement);

                                // Add click event listeners to related concept links and toggle buttons
                relatedConceptsElement.querySelectorAll('.related-concept-link').forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const concept = e.currentTarget.getAttribute('data-concept');
                        if (concept) {
                            document.getElementById('user-input').value = `Tell me more about ${concept}`;
                            sendMessage();
                        } else {
                            console.error('No concept found for this link');
                        }
                    });
                });

                relatedConceptsElement.querySelectorAll('.toggle-description').forEach(button => {
                    button.addEventListener('click', function () {
                        const targetIndex = this.getAttribute('data-target');
                        const listItem = this.closest('li');
                        const preview = listItem.querySelector('.description-preview');
                        const full = listItem.querySelector('.description-full');

                        if (full.style.display === 'none') {
                            preview.style.display = 'none';
                            full.style.display = 'inline';
                            this.textContent = 'Show Less';
                        } else {
                            preview.style.display = 'inline';
                            full.style.display = 'none';
                            this.textContent = 'Show More';
                        }
                    });
                });
            }

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
            // span.textContent = escapeSpecialChars(message);
            span.textContent = message;
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
    function showWorkshopLinks() {
        const workshopLinks = [
            { title: "Intro Lab", url: "https://mongodb-developer.github.io/intro-lab/" },
            { title: "Aggregation Pipeline Lab", url: "https://mongodb-developer.github.io/aggregation-pipeline-lab/" },
            { title: "Search Lab", url: "https://mongodb-developer.github.io/search-lab/" },
            { title: "AI RAG Lab", url: "https://mongodb-developer.github.io/ai-rag-lab/" }
        ];

        let tableHTML = `
        <table class="table table-striped workshop-links-table">
            <thead>
                <tr>
                    <th scope="col">Workshop</th>
                    <th scope="col">Link</th>
                </tr>
            </thead>
            <tbody>
    `;

        workshopLinks.forEach(workshop => {
            tableHTML += `
            <tr>
                <td>${workshop.title}</td>
                <td><a href="${workshop.url}" target="_blank">${workshop.url}</a></td>
            </tr>
        `;
        });

        tableHTML += `
            </tbody>
        </table>
    `;

        const message = `Here are the links to our MongoDB workshops:<br><br>${tableHTML}`;
        appendMessage('Assistant', message);
        LoaderManager.hideLoader();
    }

    function handleCommand(command) {
        const [baseCommand, ...args] = command.split(' ');
        const action = args.join(' ').toLowerCase();
        appendMessage('User', baseCommand);
        LoaderManager.hideLoader();

        switch (baseCommand.toLowerCase()) {
            case '/help':
            case '/h':
                showHelpInformation();
                break;
            case '/workshops':
            case '/w':
                showWorkshopLinks();
                break;
            // case '/check':
            // case '/c':
            //     if (action.toLowerCase() === 'connection') {
            //         checkConnection();
            //     } else if (action.toLowerCase() === 'backend') {
            //         checkCodeSpace(action.toLowerCase());
            //     } else if (action.toLowerCase() === 'frontend') {
            //         appendMessage('Assistant', 'front-end checking is not supported at this time.')
            //         return;
            //     }
            //     break;
            // case '/load':
            // case '/l':
            //     if (action.toLowerCase() === 'data') {
            //         loadData();
            //     }
            //     break;
            // case '/add':
            // case '/a':
            //     if (action.toLowerCase() === 'vectors') {
            //         addVectors();
            //     }
            //     break;
            // case '/mongo':
            // case '/m':
            //     executeMongoShellCommand(command);
            //     break;
            default:
                appendMessage('Assistant', 'Invalid command. Please check the available commands.');
                LoaderManager.hideLoader();
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
                    <td>/workshops or /w</td>
                    <td>Show links to the Developer Days workshops</td>
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
        LoaderManager.hideLoader();
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
    async function checkCodeSpace(checkType) {
        try {
            const response = await fetch(`/api/check_codespace/${checkType}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            appendMessage('Assistant', `${checkType.charAt(0).toUpperCase() + checkType.slice(1)} check result: ${data.message}. ${data.details}`);

            if (data.sample_book) {
                appendMessage('Assistant', `Sample book from ${checkType}: ${JSON.stringify(data.sample_book)}`);
            }
        } catch (error) {
            console.error('Error during codespace check:', error);
            appendMessage('Assistant', `Error checking ${checkType} codespace: ${error.message}. Verify the GitHub Codespace backend URL, and try to restart your codespaces instance and ensure that you've set the ports to public. If codespaces becomes unresponsive, destory the codespace and re-launch.  https://github.com/codespaces/new/mongodb-developer/library-management-system?quickstart=1`);
        }
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
        // Check if connection string starts with a protocol
        if (!connectionString.startsWith('http://') && !connectionString.startsWith('https://')) {
            // Default to http if no protocol is provided
            connectionString = 'http://' + connectionString;
        }

        try {
            return new URL(connectionString);  // Create URL object
        } catch (error) {
            console.error('Invalid URL format:', error);
            throw new Error('Invalid connection string format');
        }
    }


    async function checkConnection(connectionString) {
        try {

            const profile_response = await fetch('/api/user_profile');
            const profileData = await profile_response.json();

            if (profileData.atlas_connection_string) {
                const sanitizedURL = sanitizeConnectionString(connectionString);
                appendMessage('Assistant', `I found a connection string stored in your profile. The sanitized version is: ${sanitizedConnectionString}. `);
            } else {
                const profileLink = '<a href="/profile" target="_blank">profile settings</a>';
                appendMessage('Assistant', `I couldn't find a connection string in your profile. You can add one in your ${profileLink}. For now, please enter your MongoDB connection string to load data. (Don't worry, it will be handled securely and won't be stored.)`);

            }
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
                sendMessage(null, 'How can I update the firewall in Atlas to enable connections from anywhere?');
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
            button.addEventListener('click', function () {
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
                appendMessage('Assistant', "Data import process completed successfully.");
                appendMessage('Assistant', data.message);
            } else {
                appendMessage('Assistant', `Error during data import: ${data.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            appendMessage('Assistant', "Sorry, there was an error during the data import process. Please try again later.");
        }
        chatState.loadDataPending = false;
        saveChatState();
        hideWorkflowIndicator();
    }

    async function addVectors(connectionString, provider) {
        appendMessage('Assistant', "Starting vector addition process...");
        try {
            const response = await fetch('/api/add_vectors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    connectionString: connectionString,
                    provider: provider
                })
            });
            const data = await response.json();
            if (data.success) {
                appendMessage('Assistant', "Vector addition process completed successfully.");
                appendMessage('Assistant', data.message);
            } else {
                appendMessage('Assistant', `Error starting vector addition: ${data.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            appendMessage('Assistant', "Sorry, there was an error during the vector addition process. Please try again later.");
        }
        chatState.addVectorsPending = false;
        saveChatState();
        hideWorkflowIndicator();
    }

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

    async function logMetrics(searchType, userId) {
        try {
            // Send the metrics data to the backend
            const response = await fetch('/api/logMetrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ searchType, userId })
            });
    
            if (!response.ok) {
                throw new Error(`Error logging metrics: ${response.statusText}`);
            }
    
            console.log('Metrics logged successfully on the backend');
        } catch (error) {
            console.error('Error logging metrics:', error);
        }
    }

})();