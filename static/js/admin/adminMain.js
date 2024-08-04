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
    truncateText
} from './adminQuestions.js';
import { 
    fetchAndDisplayStatistics, 
    showStatistics
} from './adminStatistics.js';
import * as adminConversations from './adminConversations.js';
import * as adminEvents from './adminEvents.js';
import * as adminSources from './adminSources.js';
import {
    showDesignReviews,
    deleteReview,
    showEditReviewModal,
    updateReview
} from './adminReviews.js';
import { escapeHTML, showError, unescapeHTML } from './utils.js';
import * as adminStatistics from './adminStatistics.js';



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
                        adminEvents.showEventSettings();
                        break;
                    case 'showQuestionSources':
                        console.log('Calling showQuestionSources');
                        adminSources.showQuestionSources();
                        break;
                    case 'showDesignReviews':
                        console.log('Calling showDesignReviews');
                        showDesignReviews();
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