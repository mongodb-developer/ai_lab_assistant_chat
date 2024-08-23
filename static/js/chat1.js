(function () {
    let chatContainer;
    let currentConversationId = null;
    let currentFocus = -1;

    document.addEventListener('DOMContentLoaded', function () {
        console.log("DOM fully loaded");

        // Initialize chatContainer
        chatContainer = document.getElementById('chat-container');
        if (!chatContainer) {
            console.error('Chat container not found');
            return;
        }

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

        const userInput = document.getElementById('user-input');
        if (autocompleteDropdown && !autocompleteDropdown.contains(event.target) && event.target !== userInput) {
            hideAutocompleteDropdown();
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
        // const userInput = document.getElementById('user-input');
        if (userInput) {
            userInput.addEventListener('focus', function () {
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
                    sendMessage();
                }
            });

            sendButton.addEventListener('click', sendMessage);
            sendButton.addEventListener('touchstart', function (event) {
                event.preventDefault();
                sendMessage();
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

    async function sendMessage(event) {
        const userInput = document.getElementById('user-input');
        const moduleSelect = document.getElementById('moduleDropdown');
        const message = userInput.value.trim();
        let selectedModule = moduleSelect.textContent.trim();
        if (selectedModule.toLowerCase() === "select a module") {
            selectedModule = "";
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
            const loader = appendLoader();

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
                        original_question: message,
                        related_concepts: data.related_concepts || [] // Add this line
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

        console.log(`Appending message from ${sender}:`, message);

        const messageId = generateUniqueId();
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-bubble', sender.toLowerCase());
        messageElement.id = messageId;

        if (sender.toLowerCase() === 'assistant') {
            const bubbleContent = document.createElement('div');
            bubbleContent.classList.add('bubble-content');
            bubbleContent.innerHTML = marked.parse(escapeSpecialChars(message));
            messageElement.appendChild(bubbleContent);

            // Create and append the source element
            const sourceElement = document.createElement('div');
            sourceElement.classList.add('source-info');

            if (data && data.source === 'LLM') {
                sourceElement.textContent = 'Source: Generated by LLM';
            } else if (data && data.source === 'database') {
                const scoreText = data.score ? ` (Match score: ${data.score.toFixed(4)})` : '';
                sourceElement.textContent = `Source: From previous response${scoreText}`;
            } else {
                sourceElement.textContent = 'Source: Unknown';
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
            
                // Ensure the graph container is in the DOM before creating the graph
                setTimeout(() => {
                    const collapseElement = relatedConceptsElement.querySelector(`#${collapseId}`);
                    collapseElement.addEventListener('shown.bs.collapse', function () {
                        const graphContainerId = `graph-${messageId}`;
                        const graphContainer = document.getElementById(graphContainerId);
                        if (graphContainer && !graphContainer.hasChildNodes()) {
                            createKnowledgeGraph(graphContainerId, data.related_concepts, data.original_question);
                        }
                    });
                }, 100); 
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
                    button.addEventListener('click', function() {
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
            span.textContent = escapeSpecialChars(message);
            messageElement.appendChild(span);
        }

        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function createKnowledgeGraph(containerId, concepts, originalQuestion) {
        console.log(`Attempting to create knowledge graph for container: ${containerId}`);
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with id ${containerId} not found`);
            return;
        }
    
        console.log(`Container found: `, container);
    
        if (typeof vis === 'undefined') {
            console.error('vis is not defined. Make sure the vis.js library is properly loaded.');
            return;
        }
    
        // Clear the container before creating a new graph
        container.innerHTML = '';
    
        const nodes = [
            { id: 'question', label: originalQuestion, color: '#FFA500', font: { size: 18 } }  // Orange for the original question
        ];
        const edges = [];

        const nodeMap = new Map();
        nodeMap.set(originalQuestion, 'question');

        concepts.forEach((concept, index) => {
            if (!nodeMap.has(concept.concept)) {
                const nodeId = `concept${index}`;
                nodes.push({ 
                    id: nodeId, 
                    label: concept.concept, 
                    color: '#4CAF50',  // Green for primary related concepts
                    font: { size: 14 }
                });
                nodeMap.set(concept.concept, nodeId);
                edges.push({ from: 'question', to: nodeId, length: 150 });  // Reduced length from 200 to 100
            }
    
            // Add secondary connections
            if (concept.related_concepts) {
                concept.related_concepts.forEach((relatedConcept, relIndex) => {
                    if (!nodeMap.has(relatedConcept)) {
                        const nodeId = `related${index}_${relIndex}`;
                        nodes.push({ 
                            id: nodeId, 
                            label: relatedConcept, 
                            color: '#2196F3',  // Blue for secondary related concepts
                            font: { size: 12 }
                        });
                        nodeMap.set(relatedConcept, nodeId);
                    }
                    edges.push({ from: nodeMap.get(concept.concept), to: nodeMap.get(relatedConcept), length: 75 });  // Reduced length from 150 to 75
                });
            }
        });
    
        const data = {
            nodes: new vis.DataSet(nodes),
            edges: new vis.DataSet(edges)
        };
    
        const options = {
            nodes: {
                shape: 'dot',
                size: 16,
                font: {
                    size: 12,
                    face: 'Tahoma'
                }
            },
            edges: {
                width: 0.15,
                color: { inherit: 'both' },
                smooth: {
                    type: 'continuous'
                }
            },
            physics: {
                enabled: true,
                barnesHut: {
                    gravitationalConstant: -2000,  // Reduced from -80000 to bring nodes closer
                    centralGravity: 0.3,           // Added to keep nodes more centered
                    springLength: 95,              // Reduced from 200 to make connections shorter
                    springConstant: 0.04,          // Increased from 0.001 to make edges shorter
                    damping: 0.09                  // Added to reduce oscillation
                },
                stabilization: {
                    iterations: 200                // Increased for better initial layout
                }
            },
            layout: {
                improvedLayout: true,
                clusterThreshold: 150,             // Added to improve layout for larger graphs
                randomSeed: 2                      // Added for consistency in layout
            },
            interaction: {
                tooltipDelay: 200,
                hideEdgesOnDrag: true,
                multiselect: true,
                dragNodes: true,                   // Ensure nodes are draggable
                zoomView: true                     // Allow zooming
            }
        };
    
        try {
            new vis.Network(container, data, options);
            console.log(`Knowledge graph created successfully for ${containerId}`);
            network.on("doubleClick", function() {
                network.fit({ animation: true });
            });
        } catch (error) {
            console.error(`Error creating knowledge graph for ${containerId}:`, error);
        }
    }

    function createConceptCards(concepts) {
        return concepts.map((concept, index) => `
            <div class="concept-card" data-concept="${escapeHTML(concept.concept)}">
                <h3>${escapeHTML(concept.concept)}</h3>
                <p class="description-preview">${escapeHTML(concept.description.substring(0, 100))}...</p>
                <div class="description-full" style="display: none;">
                    ${escapeHTML(concept.description)}
                </div>
                <button class="toggle-description" data-target="${index}">Learn More</button>
                <div class="concept-actions">
                    <button class="explore-btn">Explore in Graph</button>
                    <button class="ask-btn">Ask About This</button>
                </div>
            </div>
        `).join('');
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
})();