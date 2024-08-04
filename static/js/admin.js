/**
 * admin.js - Administration Panel JavaScript
 * 
 * This file contains the core functionality for the admin panel of the application.
 * It handles user interactions, data fetching, and dynamic content updates for various
 * administrative tasks such as managing questions, users, and viewing statistics.
 *
 * @module admin
 */

import { showDesignReviews, editReview, updateReview, deleteReview, reviewDesign, createScoreIndicator, showEditReviewModal } from './designReviews.js';

self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            if ('navigationPreload' in self.registration) {
                await self.registration.navigationPreload.enable();
            }
        })()
    );
});

/**
 * Initializes the admin panel functionality when the DOM is fully loaded.
 * Sets up event listeners and loads initial data.
 *
 * @function
 * @name initAdminPanel
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
    fetchQuestions();
    fetchUnansweredQuestions();
    fetchUsers();
    showQuestions();
    window.showDesignReviews = showDesignReviews;
    window.editReview = editReview;
    window.updateReview = updateReview;
    window.deleteReview = deleteReview;
    window.reviewDesign = reviewDesign;
    window.showEditReviewModal = showEditReviewModal;
    const generateAnswerBtn = document.getElementById('generate-answer-btn');
    if (generateAnswerBtn) {
        generateAnswerBtn.addEventListener('click', generateAnswer);
    }
    const answerStatsButton = document.querySelector('button[onclick="showAnswerFeedbackStats()"]');
    if (answerStatsButton) {
        answerStatsButton.addEventListener('click', showAnswerFeedbackStats);
    }
    const usersTab = document.querySelector('[onclick="showUsers()"]');
    if (usersTab) {
        usersTab.addEventListener('click', showUsers);
    }
    // Try to find the statistics tab button in multiple ways
    const statisticsTab = document.querySelector('[onclick="showAnswerFeedbackStats()"]');
    if (statisticsTab) {
        statisticsTab.removeAttribute('onclick');
        statisticsTab.addEventListener('click', showStatistics);
    } else {
        console.error('Statistics tab not found');
    }
    document.getElementById('question-form').addEventListener('submit', updateQuestion);
    const generateBtn = document.getElementById('generate-answer-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateAnswer);
    }
    const questionsTab = document.querySelector('[onclick="showQuestions()"]');
    if (questionsTab) {
        questionsTab.addEventListener('click', showQuestions);
    }

    // Initial load of questions if we're on the questions tab
    if (window.location.hash === '#questions' || !window.location.hash) {
        showQuestions();
    }
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.addEventListener('click', handleMainContentClick);
    } else {
        console.error('Main content element not found');
    }
    function showEventSettings() {
        // Hide other content and show event settings
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('show', 'active'));
        document.getElementById('event-settings').classList.add('show', 'active');
        fetchEvents();
    }

    // Add event listener for the view conversations link
    
    createUserGrowthChart();
    const searchButton = document.getElementById('search-button');
    const searchQuery = document.getElementById('search-query');
    const searchResults = document.getElementById('search-results');

    searchButton.addEventListener('click', function () {
        const query = searchQuery.value.trim();
        if (!query) {
            alert('Please enter a search query');
            return;
        }

        fetch(`/api/admin/search_similar_questions?query=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    searchResults.innerHTML = `<p class="text-danger">${data.error}</p>`;
                } else {
                    let resultsHtml = '<table class="table"><thead><tr><th>Question</th><th>Title</th><th>Answer Preview</th><th>Score</th></tr></thead><tbody>';
                    data.forEach(item => {
                        resultsHtml += `
                            <tr>
                                <td>${escapeHtml(item.question)}</td>
                                <td>${escapeHtml(item.title)}</td>
                                <td>${escapeHtml(item.answer)}</td>
                                <td>${item.score.toFixed(4)}</td>
                            </tr>
                        `;
                    });
                    resultsHtml += '</tbody></table>';
                    searchResults.innerHTML = resultsHtml;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                searchResults.innerHTML = '<p class="text-danger">An error occurred while searching</p>';
            });
    });

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    const designReviewsTab = document.querySelector('#design-reviews-tab');
    if (designReviewsTab) {
        designReviewsTab.addEventListener('click', showDesignReviews);
    }
    const unansweredQuestionsTab = document.querySelector('[onclick="showUnansweredQuestions()"]');
    if (unansweredQuestionsTab) {
        unansweredQuestionsTab.removeAttribute('onclick');
        unansweredQuestionsTab.addEventListener('click', showUnansweredQuestions);
    } else {
        console.error('Unanswered questions tab not found');
    }

});

let currentPage = 1;
const perPage = 10;

document.getElementById('updateReviewButton').addEventListener('click', function (e) {
    e.preventDefault(); // Prevent any default action
    updateReview();
});


function handleMainContentClick(e) {
    if (e.target.closest('#conversations-pagination')) {
        e.preventDefault();
        if (e.target.tagName === 'A') {
            const page = parseInt(e.target.getAttribute('data-page'));
            loadConversations(page);
        }
    } else if (e.target.classList.contains('view-conversation')) {
        const conversationId = e.target.getAttribute('data-id');
        viewConversation(conversationId);
    }
}

var triggerTabList = [].slice.call(document.querySelectorAll('#myTab a'))
triggerTabList.forEach(function (triggerEl) {
    var tabTrigger = new bootstrap.Tab(triggerEl)
    triggerEl.addEventListener('click', function (event) {
        event.preventDefault()
        tabTrigger.show()
    })
})

const generateAnswerBtn = document.getElementById('generate-answer-btn');
if (generateAnswerBtn) {
    generateAnswerBtn.addEventListener('click', generateAnswer);
}





// Unescape HTML special characters in a string
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

async function searchQuestions() {
    const query = document.getElementById('question-search').value;
    console.log('Search query:', query);

    if (!query) {
        fetchQuestions();
        return;
    }

    try {
        const response = await fetch(`/api/admin/search_questions?query=${encodeURIComponent(query)}`);
        console.log('Search response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const questions = await response.json();
        console.log('Received questions:', questions);

        populateQuestionsTable(questions);
        // Hide pagination for search results
        document.getElementById('questions-pagination').style.display = 'none';
    } catch (error) {
        console.error('Error searching questions:', error);
        alert('An error occurred while searching questions. Please try again.');
    }
}
// Update the event listener for viewing conversations
document.getElementById('conversations-body').addEventListener('click', function (e) {
    if (e.target.classList.contains('view-conversation')) {
        const conversationId = e.target.getAttribute('data-id');
        viewConversation(conversationId);
    }
});

document.getElementById('view-conversations-link').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('conversations-table').style.display = 'block';
    loadConversations(1);
});

document.getElementById('conversations-pagination').addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
        e.preventDefault();
        const page = parseInt(e.target.getAttribute('data-page'));
        loadConversations(page);
    }
});

document.getElementById('conversations-body').addEventListener('click', function (e) {
    if (e.target.classList.contains('view-conversation')) {
        const conversationId = e.target.getAttribute('data-id');
        // Implement viewing individual conversation here
        console.log('View conversation:', conversationId);
    }
});



function truncateText(text, maxLength = 50) {
    if (text && text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text || '';
}

function showError(message) {
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
}

function hideError() {
    const errorContainer = document.getElementById('error-container');
    errorContainer.style.display = 'none';
}
document.querySelector('#error-container .close').addEventListener('click', hideError);

function createTableRow(cells) {
    const row = document.createElement('tr');
    cells.forEach(cell => {
      const td = document.createElement('td');
      td.innerHTML = cell;
      row.appendChild(td);
    });
    return row;
  }