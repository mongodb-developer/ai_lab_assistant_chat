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
        const userInput = document.getElementById('user-input');
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
        const feedbackContainer = document.createElement('div');
        feedbackContainer.classList.add('feedback-container');

        const positiveButton = document.createElement('button');
        positiveButton.textContent = '👍';
        positiveButton.onclick = () => provideFeedback(data.question_id, true);

        const negativeButton = document.createElement('button');
        negativeButton.textContent = '👎';
        negativeButton.onclick = () => provideFeedback(data.question_id, false);

        feedbackContainer.appendChild(positiveButton);
        feedbackContainer.appendChild(negativeButton);
        messageElement.appendChild(feedbackContainer);
    }

    async function provideFeedback(questionId, isPositive) {
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question_id: questionId,
                    is_positive: isPositive
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Feedback submitted:', result);
            // You might want to update the UI to reflect the submitted feedback
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    }

    async function sendMessage(event) {
        const userInput = document.getElementById('user-input');
        const moduleSelect = document.getElementById('moduleDropdown');
        const message = userInput.value.trim();
        const selectedModule = moduleSelect.textContent.trim();
    
        if (message) {
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
            messageElement.innerHTML = marked.parse(escapeSpecialChars(message));
            if (data && data.source) {
                const sourceElement = document.createElement('div');
                sourceElement.classList.add('source-info');
                
                if (data.source === 'LLM') {
                    sourceElement.textContent = 'Source: Generated by LLM';
                } else {
                    const scoreText = data.score ? ` (Match score: ${data.score.toFixed(4)})` : '';
                    sourceElement.textContent = `Source: From previous response${scoreText}`;
                }
                
                messageElement.appendChild(sourceElement);
                showFeedbackPopup();
            }
        } else {
            const span = document.createElement('span');
            span.textContent = escapeSpecialChars(message);
            messageElement.appendChild(span);
        }

        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        if (sender.toLowerCase() === 'assistant' && data) {
            appendFeedbackButtons(messageElement, {
                question_id: data.question_id || '',
                original_question: data.original_question || ''
            });        }
    }
})();