// chat2.js

import { updateKnowledgeGraph, searchKnowledgeGraph } from './sharedKnowledgeGraph.js';
let currentFocus = -1;

const Chat = (function () {
    let chatContainer;
    let userInput;
    let sendButton;
    let moduleDropdown;

    function initialize() {
        document.addEventListener('knowledgeGraphNodeClicked', handleNodeClick);

        document.addEventListener('DOMContentLoaded', function () {
            chatContainer = document.getElementById('chat-container');
            userInput = document.getElementById('user-input');
            sendButton = document.getElementById('send-button');
            moduleDropdown = document.getElementById('moduleDropdown');

            if (!chatContainer || !userInput || !sendButton || !moduleDropdown) {
                console.error('One or more chat elements not found');
                return;
            }
            

            setupEventListeners();
            initializeUI();
        });
    }

    function closeModuleDropdown(event) {
        if (!moduleDropdown.contains(event.target)) {
            const dropdownMenu = moduleDropdown.querySelector('.dropdown-menu');
            dropdownMenu.classList.remove('show');
        }
    }

    function handleNodeClick(event) {
        const nodeId = event.detail.nodeId;
        const question = `Tell me more about "${nodeId}" in the context of our conversation.`;
        userInput.value = question;
        sendMessage();
    }

    function selectModule(module) {
        moduleDropdown.textContent = module;
        const dropdownMenu = moduleDropdown.querySelector('.dropdown-menu');
        dropdownMenu.classList.remove('show');
    }

    function setupEventListeners() {
        sendButton.addEventListener('click', sendMessage);
        userInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        moduleDropdown.addEventListener('click', hideAutocompleteDropdown);
        document.addEventListener('click', closeModuleDropdown);

        window.addEventListener('resize', handleResize);
        userInput.addEventListener('input', debounce(getSuggestions, 300));
        userInput.addEventListener('keydown', handleKeyDown);
    }

    function handleKeyDown(e) {
        // Implement your key down handling logic here
        console.log('handleKeyDown called');
    }

    function closeModuleDropdown(event) {
        if (moduleDropdown && !moduleDropdown.contains(event.target)) {
            const dropdownMenu = moduleDropdown.querySelector('.dropdown-menu');
            if (dropdownMenu) {
                dropdownMenu.classList.remove('show');
            }
        }
    }

    function getSuggestions() {
        // Implement your autocomplete logic here
        console.log('getSuggestions called');
    }

    function initializeUI() {
        // Initialize any UI components here
        if (chatContainer.children.length > 0) {
            scrollToBottom();
        }
        workflowIndicator = document.getElementById('workflow-indicator');
        const cancelWorkflowBtn = document.getElementById('cancel-workflow');
        if (cancelWorkflowBtn) {
            cancelWorkflowBtn.addEventListener('click', cancelWorkflow);
        }
    }

    function showWorkflowIndicator(message) {
        if (workflowIndicator) {
            const messageSpan = workflowIndicator.querySelector('#workflow-message');
            if (messageSpan) {
                messageSpan.textContent = message;
            }
            workflowIndicator.style.display = 'flex';
        }
    }

    function hideAutocompleteDropdown() {
        const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
        if (autocompleteDropdown) {
            autocompleteDropdown.style.display = 'none';
        }
    }

    function hideWorkflowIndicator() {
        if (workflowIndicator) {
            workflowIndicator.style.display = 'none';
        }
    }

    function cancelWorkflow() {
        // Implementation for cancelling the current workflow
        hideWorkflowIndicator();
        // Additional logic for cancelling the workflow
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    function appendMessage(sender, message, data = null) {
        if (!chatContainer) {
            console.error('Chat container not initialized');
            return;
        }

        const decodedMessage = decodeHTMLEntities(message);

        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-bubble', sender.toLowerCase());

        if (sender.toLowerCase() === 'assistant') {
            messageElement.innerHTML = marked.parse(decodedMessage);
        } else {
            const span = document.createElement('span');
            span.textContent = decodedMessage;
            messageElement.appendChild(span);
        }

        chatContainer.appendChild(messageElement);
        scrollToBottom();
    }

    function decodeHTMLEntities(text) {
        const textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        return textArea.value;
    }
    function escapeSpecialChars(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    function scrollToBottom() {
        if (chatContainer && chatContainer.scrollHeight) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    async function sendMessage() {
        if (!chatContainer || !userInput) {
            console.error('Chat elements not initialized');
            return;
        }
        hideAutocompleteDropdown()
        const message = userInput.value.trim();
        const selectedModule = moduleDropdown.textContent.trim();

        if (message) {
            appendMessage('User', message);
            userInput.value = '';

            // Dispatch custom event for chat message sent
            document.dispatchEvent(new CustomEvent('chatMessageSent', {
                detail: { message: message }
            }));

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        question: message,
                        module: selectedModule !== 'Select a Module' ? selectedModule : ''
                    })
                });

                const data = await response.json();

                if (data && data.related_concepts && data.related_concepts.length > 0) {
                    const relatedConceptsElement = document.createElement('div');
                    relatedConceptsElement.classList.add('related-concepts');
                    relatedConceptsElement.innerHTML = `
                        <h4>Related Concepts:</h4>
                        <ul>
                            ${data.related_concepts.map(concept => `
                                <li>
                                    <a href="#" class="related-concept-link" data-concept="${escapeHTML(concept.concept)}">
                                        <strong>${escapeHTML(concept.concept)}</strong>
                                    </a>: 
                                    ${escapeHTML(concept.description || 'No description available')}
                                </li>
                            `).join('')}
                        </ul>
                    `;
                    messageElement.appendChild(relatedConceptsElement);
        
                    // Add click event listeners to related concept links
                    relatedConceptsElement.querySelectorAll('.related-concept-link').forEach(link => {
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            const concept = e.currentTarget.getAttribute('data-concept');
                            if (concept) {
                                document.getElementById('user-input').value = `Tell me more about ${concept}`;
                                sendMessage(null, `Tell me more about ${concept}`);
                            } else {
                                console.error('Concept attribute not found on clicked element');
                            }
                        });
                    });
                }

                if (data.answer) {
                    appendMessage('Assistant', data.answer);
                    updateKnowledgeGraph(message, data.answer);
                    searchKnowledgeGraph('graph-container', message);  // Updated this line
                    window.dispatchUpdateKnowledgeGraph(message, data.answer);
                } else {
                    appendMessage('Assistant', 'I couldn\'t find an answer to your question.');
                }
            } catch (error) {
                console.error('Error:', error);
                appendMessage('Assistant', 'An error occurred while processing your request.');
            }

            scrollToBottom();
        }
    }

    function handleResize() {
        // Implementation here
    }

    // Public methods
    return {
        initialize,
        appendMessage,
        sendMessage,
        handleNodeClick
    };
})();

// Initialize the chat
Chat.initialize();

// Expose necessary functions to global scope if needed
window.sendMessage = Chat.sendMessage;
window.appendMessage = Chat.appendMessage;