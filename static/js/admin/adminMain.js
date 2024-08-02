import {
    showUsers,
    fetchUsers,
    populateUsersTable,
    showEditUserForm,
    updateUser,
    getCurrentUserId,
    toggleAdminStatus
} from './adminUsers.js';
import { 
    fetchQuestions, 
    populateQuestionsTable, 
    showQuestions, 
    showUnansweredQuestions,
    showAddQuestionForm,
    showEditQuestionForm,
    showAnswerQuestionForm,
    deleteQuestion,
    deleteUnansweredQuestion,
    truncateText,
    unescapeHTML
} from './adminQuestions.js';
import { 
    fetchAndDisplayStatistics, 
    showStatistics
} from './adminStatistics.js';
import { 
    showConversations, 
    loadConversations, 
    updateConversationPagination, 
    viewConversation, 
    createConversationModal 
} from './adminConversations.js';
import {
    showEventSettings,
    fetchEvents,
    populateEventsTable,
    showAddEventForm,
    saveEvent,
    updateEvent,
    editEvent,
    deleteEvent,
    displayEventMap
} from './adminEvents.js';
import * as adminSources from './adminSources.js';

import {
    showDesignReviews,
    deleteReview,
    showEditReviewModal,
    updateReview
} from './adminReviews.js';

/**
 * Escapes HTML special characters in a string to prevent XSS attacks.
 *
 * @function
 * @name escapeHtml
 * @param {string} unsafe - The string containing potentially unsafe HTML.
 * @returns {string} The input string with HTML special characters escaped.
 */
export function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/**
 * Initializes the admin panel functionality when the DOM is fully loaded.
 * Sets up event listeners and loads initial data.
 *
 * @function
 * @name initAdminPanel
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.addEventListener('click', (event) => {
            const link = event.target.closest('[data-action]');
            if (link) {
                event.preventDefault();
                const action = link.getAttribute('data-action');
                console.log('Sidebar link clicked:', action);

                switch(action) {
                    case 'showQuestions':
                        console.log('Calling showQuestions');
                        showQuestions();
                        break;
                    case 'showUnansweredQuestions':
                        console.log('Calling showUnansweredQuestions');
                        showUnansweredQuestions();
                        break;
                    case 'showUsers':
                        console.log('Calling showUsers');
                        showUsers();
                        break;
                    case 'showStatistics':
                        console.log('Calling showStatistics');
                        adminStatistics.showStatistics();
                        break;
                    case 'showConversations':
                        console.log('Calling showConversations');
                        adminConversations.showConversations();
                        break;
                    case 'showEvents':
                        console.log('Calling showEvents');
                        adminEvents.showEvents();
                        break;
                    case 'showQuestionSources':
                        console.log('Calling showQuestionSources');
                        adminSources.showQuestionSources();
                        break;
                    case 'showDesignReviews':
                        console.log('Calling showDesignReviews');
                        adminReviews.showDesignReviews();
                        break;
                    default:
                        console.error('Unknown action:', action);
                }
            }
        });
    } else {
        console.error('Sidebar element not found');
    }

    // Initial setup
    showQuestions();

    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.addEventListener('click', handleMainContentClick);
    } else {
        console.error('Main content element not found');
    }

    // Set up tab functionality
    var triggerTabList = [].slice.call(document.querySelectorAll('#myTab a'))
    triggerTabList.forEach(function (triggerEl) {
        var tabTrigger = new bootstrap.Tab(triggerEl)
        triggerEl.addEventListener('click', function (event) {
            event.preventDefault()
            tabTrigger.show()
        })
    })
});

export function handleMainContentClick(e) {
    if (e.target.closest('#conversations-pagination')) {
        e.preventDefault();
        if (e.target.tagName === 'A') {
            const page = parseInt(e.target.getAttribute('data-page'));
            adminConversations.loadConversations(page);
        }
    } else if (e.target.classList.contains('view-conversation')) {
        const conversationId = e.target.getAttribute('data-id');
        adminConversations.viewConversation(conversationId);
    }
}