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
let currentFocus = -1;

async function getCurrentUserId() {
    try {
        const response = await fetch('/api/current_user_id');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch current user ID. Status: ${response.status}, Response: ${errorText}`);
        }
        const data = await response.json();
        return data.userId;
    } catch (error) {
        console.error('Error getting current user ID:', error);
        return null;
    }
}

// import WizardFeatures from './wizardFeatures.js';

// const wizardFeatures = WizardFeatures;
// wizardFeatures.init(appendMessage, getCurrentUserId);

document.addEventListener('click', function (e) {
    if (!e.target.closest('.autocomplete-wrapper')) {
        document.getElementById('autocomplete-dropdown').style.display = 'none';
    }
});
async function getSuggestions() {
    const input = document.getElementById('user-input');
    const dropdown = document.getElementById('autocomplete-dropdown');

    if (!input.value) {
        dropdown.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`/api/autocomplete?prefix=${encodeURIComponent(input.value)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const suggestions = await response.json();

        dropdown.innerHTML = '';
        suggestions.forEach((suggestion) => {
            const div = document.createElement('div');
            div.innerHTML = suggestion;
            div.addEventListener('click', function () {
                input.value = this.innerText;
                dropdown.innerHTML = '';
            });
            dropdown.appendChild(div);
        });

        dropdown.style.display = 'block';
    } catch (error) {
        console.error('Error fetching suggestions:', error);
    }
}

function handleKeyDown(e) {
    const dropdown = document.getElementById('autocomplete-dropdown');
    const items = dropdown.getElementsByTagName('div');

    if (e.keyCode === 40) { // down arrow
        currentFocus++;
        addActive(items);
    } else if (e.keyCode === 38) { // up arrow
        currentFocus--;
        addActive(items);
    } else if (e.keyCode === 13) { // enter
        e.preventDefault();
        if (currentFocus > -1) {
            if (items) items[currentFocus].click();
        }
    }
}

function addActive(items) {
    if (!items) return false;
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (items.length - 1);
    items[currentFocus].classList.add('autocomplete-active');
}

function removeActive(items) {
    for (let i = 0; i < items.length; i++) {
        items[i].classList.remove('autocomplete-active');
    }
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

    userInput.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // console.log('Chat initialized successfully');
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
        if (data && data.source) {
            const sourceElement = document.createElement('div');
            sourceElement.classList.add('source-info');
            
            if (data.source === 'LLM') {
                sourceElement.textContent = 'Source: Generated by LLM';
            } else {
                // Include the score if it's from a previous response
                const scoreText = data.score ? ` (Match score: ${data.score.toFixed(4)})` : '';
                sourceElement.textContent = `Source: From previous response${scoreText}`;
            }
            
            messageElement.appendChild(sourceElement);
            // speakResponse(message);

            showFeedbackPopup();

        }
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

async function showFeedbackPopup() {
    const feedbackContainer = document.getElementById('feedback-container');
    if (feedbackContainer) {
        const hasInteracted = await checkFeedbackStatus();
        if (!hasInteracted) {
            feedbackContainer.style.display = 'block';
        }
    }
}

async function updateFeedbackStatus() {
    try {
        const response = await fetch('/api/user_feedback_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Feedback status updated:', data);
    } catch (error) {
        console.error('Error updating feedback status:', error);
    }
}

async function hideFeedbackPopup() {
    const feedbackContainer = document.getElementById('feedback-container');
    if (feedbackContainer) {
        feedbackContainer.style.display = 'none';
        await updateFeedbackStatus();
    }
}

function setupAutocomplete() {
    const userInput = document.getElementById('user-input');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');

    userInput.addEventListener('input', function() {
        const query = this.value;
        if (!query) {
            clearAutocomplete();
            return;
        }
        fetchSuggestions(query).then(suggestions => {
            renderAutocomplete(suggestions);
        });
    });

    function fetchSuggestions(query) {
        return fetch(`/api/autocomplete?prefix=${encodeURIComponent(query)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => data)
            .catch(error => {
                console.error('Error fetching suggestions:', error);
                return [];
            });
    }

    function renderAutocomplete(suggestions) {
        clearAutocomplete();
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.classList.add('autocomplete-item');
            item.textContent = suggestion;
            item.addEventListener('click', function() {
                userInput.value = suggestion;
                clearAutocomplete();
                userInput.focus();
            });
            autocompleteDropdown.appendChild(item);
        });
    }

}

function clearAutocomplete() {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (dropdown) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
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

    const feedbackText = document.createElement('span');
    feedbackText.textContent = 'Was this response helpful?'; // Add encouraging text
    feedbackText.classList.add('feedback-text'); // Add class for styling

    const positiveButton = document.createElement('button');
    positiveButton.textContent = '👍';
    positiveButton.classList.add('thumbs-up'); // Add class
    positiveButton.onclick = () => provideAnswerFeedback(data.question_id, data.original_question, data.answer, true);

    const negativeButton = document.createElement('button');
    negativeButton.textContent = '👎';
    negativeButton.classList.add('thumbs-down'); // Add class
    negativeButton.onclick = () => provideAnswerFeedback(data.question_id, data.original_question, data.answer, false);

    feedbackContainer.appendChild(feedbackText); // Append text before buttons
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
    const userInput = document.getElementById('user-input');
    const moduleSelect = document.getElementById('module-select');
    const message = userInput.value.trim();
    const selectedModule = moduleSelect.value;

    if (message) {
        appendMessage('User', message);
        userInput.value = '';

        const loader = appendLoader();

        try {
            const userId = await getCurrentUserId();
            if (!userId) {
                throw new Error('Failed to get current user ID');
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: message,
                    conversation_id: currentConversationId,
                    module: selectedModule // Send the selected module to the backend
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

document.addEventListener('DOMContentLoaded', function () {
    if (!initChat()) {
        console.error('Failed to initialize chat. Some features may not work correctly.');
    }

    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const moduleSelect = document.getElementById('module-select');
    const moduleItems = document.querySelectorAll('.dropdown-item');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');

    let selectedModule = '';

    moduleItems.forEach(item => {
        item.addEventListener('click', function(event) {
            event.preventDefault();
            selectedModule = this.getAttribute('data-value');
            console.log('Module selected:', selectedModule);
            moduleSelect.textContent = this.textContent;
            moduleItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
    // initializeSpeechRecognition();

    const moduleDropdown = document.getElementById('moduleDropdown');
    const dropdownItems = document.querySelectorAll('.dropdown-menu .dropdown-item');

    dropdownItems.forEach(item => {
        item.addEventListener('click', function(event) {
            event.preventDefault();
            const selectedValue = this.getAttribute('data-value');
            moduleDropdown.textContent = selectedValue;
            console.log('Module selected:', selectedValue);
            // You can store the selected value in a variable or use it as needed
        });
    });

    if (userInput) {
        userInput.addEventListener('input', debounce(getSuggestions, 300));
        userInput.addEventListener('keydown', handleKeyDown);
    } else {
        console.error("Element with id 'user-input' not found");
    }

    if (userInput && sendButton) {
        let isSending = false;

        function handleSend(event) {
            event.preventDefault(); // Prevent default behavior
            if (!isSending) {
                isSending = true;
                sendMessage();
                setTimeout(() => { isSending = false; }, 300); // Debounce
            }
        }

        // Handle click events (for desktop)
        sendButton.addEventListener('click', handleSend);

        // Handle touch events (for mobile)
        sendButton.addEventListener('touchstart', handleSend);
        userInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSend(event);
            }
        });
    } else {
        console.error('User input or send button not found');
    }

    const fab = document.getElementById('sample-questions-fab');
    const modal = document.getElementById('sample-questions-modal');
    const sampleQuestions = document.querySelectorAll('.sample-question');

    if (userInput && sendButton) {
        userInput.addEventListener('input', debounce(getSuggestions, 300));
        userInput.addEventListener('keydown', handleKeyDown);

        sendButton.addEventListener('click', sendMessage);
        sendButton.addEventListener('touchend', sendMessage);
    }

    if (fab) {
        fab.addEventListener('click', function () {
            modal.style.display = 'block';
        });
    }

    sendButton.addEventListener('click', sendMessage);
    sendButton.addEventListener('touchend', sendMessage);

    // Ensure form submission also works on pressing Enter key
    document.getElementById('user-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });


    document.addEventListener('click', function (e) {
        if (!e.target.closest('.autocomplete-wrapper')) {
            document.getElementById('autocomplete-dropdown').style.display = 'none';
        }
    });

    // Autocomplete setup
    setupAutocomplete();

    if (userInput) {
        userInput.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                sendMessage(event);
            }
        });
    }

    window.addEventListener('click', function (event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    sampleQuestions.forEach(question => {
        question.addEventListener('click', function () {
            const questionText = this.textContent;
            if (userInput) {
                userInput.value = questionText;
            }
            modal.style.display = 'none';
            sendMessage(questionText);
        });
    });

    var calendlyModalElement = document.getElementById('calendlyModal');
    var bookReviewBtn = document.getElementById('book-review-btn');
    var reviewBanner = document.getElementById('review-banner');

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
    marked.setOptions({
        breaks: true,
        gfm: true,
        tables: true,
        sanitize: false, // Set to true if you want to sanitize HTML in the markdown
        smartLists: true,
        smartypants: true
    });
    // console.log('Marked library loaded:', typeof marked);
    // console.log('Markdown test:', marked.parse('# Hello\n\nThis is a **test**.'));
    const navbarToggler = document.querySelector('.navbar-toggler');
    const navbarCollapse = document.querySelector('.navbar-collapse');
    const mainNavbar = document.getElementById('mainNavbar');

    if (navbarToggler && navbarCollapse) {
        let isOpen = false;

        function toggleMenu() {
            isOpen = !isOpen;
            navbarCollapse.classList.toggle('show', isOpen);
            navbarToggler.setAttribute('aria-expanded', isOpen);
        }

        // Toggle menu when hamburger is clicked
        navbarToggler.addEventListener('click', function(event) {
            event.stopPropagation();
            toggleMenu();
        });

        // Close the menu when a nav item is clicked
        const navItems = navbarCollapse.querySelectorAll('.nav-link');
        navItems.forEach(item => {
            item.addEventListener('click', function() {
                if (window.innerWidth < 992) {  // Only on mobile
                    toggleMenu();
                }
            });
        });

        // Close the menu when clicking outside
        document.addEventListener('click', function(event) {
            const isClickInside = mainNavbar.contains(event.target);
            if (!isClickInside && isOpen) {
                toggleMenu();
            }
        });
    }
    document.querySelectorAll('.feedback-button').forEach(button => {
        button.addEventListener('click', async function() {
            const value = this.getAttribute('data-value');
            console.log('Feedback value:', value);
            
            await updateFeedbackStatus();
            hideFeedbackPopup();
        });
    });
    const requestReviewBtn = document.getElementById('request-review-btn');
    const designReviewModal = new bootstrap.Modal(document.getElementById('designReviewModal'));

    if (requestReviewBtn) {
        requestReviewBtn.addEventListener('click', function () {
            designReviewModal.show();
        });
    }

    const designReviewForm = document.getElementById('design-review-form');
    if (designReviewForm) {
        designReviewForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            const formData = new FormData(designReviewForm);
            const response = await fetch('/api/design_review', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                alert('Design Review request submitted successfully!');
                designReviewModal.hide();
            } else {
                alert('Failed to submit Design Review request.');
            }
        });
    }
});

// Attach the scoring calculation to the form submission
document.getElementById('review-form').addEventListener('submit', function (event) {
    calculateScore();
});

function calculateScore() {
    const form = document.getElementById('review-form');
    const completenessScore = calculateCompletenessScore(form);
    const skillLevelScore = calculateSkillLevelScore(form.skillLevel.value);
    const applicationStatusScore = calculateApplicationStatusScore(form.applicationStatus.value);
    const useCaseScore = calculateUseCaseScore(form);
    const dataVolumeScore = calculateDataVolumeScore(form.dataVolume.value);
    const uptimeSlaScore = calculateUptimeSlaScore(form.uptimeSla.value);
    const previousInteractionScore = calculatePreviousInteractionScore(form.previousInteraction.value);
    
    const totalScore = completenessScore + skillLevelScore + applicationStatusScore + useCaseScore + dataVolumeScore + uptimeSlaScore + previousInteractionScore;
    
    form['completeness-score'].value = completenessScore;
    form['skill-level-score'].value = skillLevelScore;
    form['application-status-score'].value = applicationStatusScore;
    form['use-case-score'].value = useCaseScore;
    form['data-volume-score'].value = dataVolumeScore;
    form['uptime-sla-score'].value = uptimeSlaScore;
    form['previous-interaction-score'].value = previousInteractionScore;
    form['total-score'].value = totalScore;
}

function calculateCompletenessScore(form) {
    let score = 0;
    if (form.name.value) score += 5;
    if (form.contactDetails.value) score += 5;
    if (form.company.value) score += 5;
    if (form.applicationDetails.value) score += 5;
    if (form.sampleDocuments.value) score += 5;
    if (form.sampleQueries.value) score += 5;
    return score;
}

function calculateSkillLevelScore(skillLevel) {
    switch (skillLevel) {
        case 'Expert': return 15;
        case 'Intermediate': return 10;
        case 'Beginner': return 5;
        default: return 0;
    }
}

function calculateApplicationStatusScore(status) {
    switch (status) {
        case 'In production': return 15;
        case 'In design phase': return 10;
        case 'Not started': return 0;
    }
}

function calculateUseCaseScore(form) {
    let score = 0;
    if (form.transactionalGuarantees.checked) score += 2;
    if (form.fullTextSearch.checked) score += 2;
    if (form.crossRegionHa.checked) score += 2;
    if (form.cloudToOnPrem.checked) score += 2;
    if (form.timeSeriesCapabilities.checked) score += 2;
    if (form.dataTiering.checked) score += 2;
    if (form.multiCloud.checked) score += 2;
    if (form.dataModelingGuidance.checked) score += 2;
    if (form.developmentAssistance.checked) score += 2;
    if (form.edgeDatabase.checked) score += 2;
    return score;
}

function calculateDataVolumeScore(dataVolume) {
    if (dataVolume >= 1000) return 10;
    if (dataVolume >= 100) return 5;
    return 0;
}

function calculateUptimeSlaScore(uptimeSla) {
    if (uptimeSla >= 99.99) return 5;
    return 0;
}

function calculatePreviousInteractionScore(previousInteraction) {
    // Assume a simple mechanism based on predefined criteria
    if (previousInteraction) return 5;
    return 0;
}

// Ensure `marked` is correctly loaded
document.addEventListener('DOMContentLoaded', () => {

    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');

    if (userInput && sendButton) {
        // Handle Enter key press in the input field
        userInput.addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
            }
        });

        // Handle click and touch events on the send button
        sendButton.addEventListener('click', sendMessage);
        sendButton.addEventListener('touchstart', function (event) {
            event.preventDefault(); // Prevent double-firing on some devices
            sendMessage();
        });
    } else {
        console.error('User input or send button not found');
    }
    let selectedModule = '';

    moduleItems.forEach(item => {
        item.addEventListener('click', function(event) {
            event.preventDefault();
            selectedModule = this.getAttribute('data-value');
            moduleSelect.textContent = this.textContent;
            moduleItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

function handleSendMessage(message) {
    // Your function to handle sending the message
    console.log('Message sent:', message); // Replace with actual message sending logic
    // Clear the input after sending the message
    document.getElementById('user-input').value = '';
    // Clear the autocomplete suggestions
    clearAutocomplete();
}
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
    return input.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}

function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'flex';
    } else {
        console.warn('Loader element not found');
    }
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    } else {
        console.warn('Loader element not found');
    }
}

function createLoader() {
    if (!document.getElementById('loader')) {
        const loader = document.createElement('div');
        loader.id = 'loader';
        loader.style.display = 'none';
        // Add any necessary loader content or styling here
        document.body.appendChild(loader);
    }
}

// Example usage
document.addEventListener('DOMContentLoaded', function () {
    createLoader();
    const loader = document.getElementById('loader');
    if (loader) {
        showLoader();
        // Simulate loading completion
        setTimeout(hideLoader, 2000);
    } else {
        console.warn('Loader element not found');
    }
});

window.handleSampleQuestion = handleSampleQuestion;
window.sendMessage = sendMessage;
window.provideAnswerFeedback = provideAnswerFeedback;


let recognition;
let voiceoverEnabled = false;

function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('user-input').value = transcript;
            sendMessage();
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error', event.error);
        };

        const micButton = document.createElement('button');
        micButton.textContent = '🎤';
        micButton.onclick = toggleSpeechRecognition;
        document.getElementById('user-input').parentNode.appendChild(micButton);
    }
}

function toggleSpeechRecognition() {
    if (recognition.isStarted) {
        recognition.stop();
    } else {
        recognition.start();
    }
    recognition.isStarted = !recognition.isStarted;
}

function speakResponse(text) {
    const speech = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(speech);
}

async function checkFeedbackStatus() {
    try {
        const response = await fetch('/api/user_feedback_status');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.feedback_status === 'interacted';
    } catch (error) {
        console.error('Error checking feedback status:', error);
        return false;
    }
}