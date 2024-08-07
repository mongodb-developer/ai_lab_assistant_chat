(function() {
    let chatContainer;
    let currentConversationId = null;
    let currentFocus = -1;

    document.addEventListener('DOMContentLoaded', function() {
        console.log("DOM fully loaded");
        
        // Initialize chatContainer
        chatContainer = document.getElementById('chat-container');
        if (!chatContainer) {
            console.error('Chat container not found');
            return;
        }

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

        const userInput = document.getElementById('user-input');
        if (autocompleteDropdown && !autocompleteDropdown.contains(event.target) && event.target !== userInput) {
            hideAutocompleteDropdown();
        }

        var dropdown = document.getElementById('moduleDropdown');
        var dropdownMenu = dropdown.nextElementSibling;
        var dropdownItems = document.querySelectorAll('.dropdown-menu .dropdown-item');
    
        console.log("Dropdown items found:", dropdownItems.length);
    
        dropdown.addEventListener('click', function(event) {
            event.stopPropagation();
            var bsDropdown = bootstrap.Dropdown.getInstance(dropdown);
            if (bsDropdown) {
                bsDropdown.toggle();
            } else {
                bsDropdown = new bootstrap.Dropdown(dropdown);
                bsDropdown.toggle();
            }
            console.log("Dropdown toggled");
        });

        dropdownItems.forEach(function(item) {
            item.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                console.log("Dropdown item clicked:", this.textContent);
                dropdown.textContent = this.textContent;
                var bsDropdown = bootstrap.Dropdown.getInstance(dropdown);
                if (bsDropdown) {
                    bsDropdown.hide();
                }
            });
        });
    
        document.addEventListener('click', function(event) {
            if (!dropdown.contains(event.target)) {
                var bsDropdown = bootstrap.Dropdown.getInstance(dropdown);
                if (bsDropdown) {
                    bsDropdown.hide();
                }
            }
        });

        const sendButton = document.getElementById('send-button');
        // const userInput = document.getElementById('user-input');
        if (userInput) {
            userInput.addEventListener('focus', function() {
                var bsDropdown = bootstrap.Dropdown.getInstance(dropdown);
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

    function provideFeedback(questionId, isPositive, originalQuestion, proposedAnswer) {
        console.log('Sending feedback:', { questionId, isPositive, originalQuestion, proposedAnswer });
        
        fetch('/api/message_feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken() // Implement this function to get the CSRF token
            },
            body: JSON.stringify({
                question_id: questionId,
                original_question: originalQuestion,
                proposed_answer: proposedAnswer,
                is_positive: isPositive
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Message feedback response:', data);
            if (data.error) {
                console.error('Feedback submission failed:', data.error);
                // Handle error (e.g., show an error message to the user)
            } else {
                console.log('Feedback submitted successfully');
                // Handle success (e.g., update UI to show feedback was received)
            }
        })
        .catch(error => {
            console.error('Error submitting message feedback:', error);
            showError('Error submitting message feedback');
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
        const selectedModule = moduleSelect.textContent.trim();
    
        if (message) {
            hideAutocompleteDropdown();  // Hide autocomplete dropdown
            appendMessage('User', message);
            userInput.value = '';
            var bsDropdown = bootstrap.Dropdown.getInstance(bsDropdown);
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

    function appendMessage(sender, message, data = null) {
        if (!chatContainer) {
            console.error('Chat container not available. Message not appended.');
            return;
        }
    
        console.log(`Appending message from ${sender}:`, message);
    
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-bubble', sender.toLowerCase());
    
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
                // Include the score if it's from a previous response
                const scoreText = data.score ? ` (Match score: ${data.score.toFixed(4)})` : '';
                sourceElement.textContent = `Source: From previous response${scoreText}`;
            } else {
                sourceElement.textContent = 'Source: Unknown';
            }
            messageElement.appendChild(sourceElement);
    
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
    function generateQuestionId(data) {
        // Use a combination of properties to create a unique ID
        return btoa(data.question).slice(0, 10);  // Base64 encode the question and take first 10 characters
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
    return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
}
})();