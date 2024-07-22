/**
 * admin.js - Administration Panel JavaScript
 * 
 * This file contains the core functionality for the admin panel of the application.
 * It handles user interactions, data fetching, and dynamic content updates for various
 * administrative tasks such as managing questions, users, and viewing statistics.
 *
 * @module admin
 */

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

    // Add event listener for the view conversations link
    const viewConversationsLink = document.getElementById('view-conversations-link');
    if (viewConversationsLink) {
        viewConversationsLink.addEventListener('click', function (e) {
            e.preventDefault();
            showConversations();
        });
    } else {
        console.error('View conversations link not found');
    }
    document.getElementById('conversations-pagination').addEventListener('click', function(e) {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const page = parseInt(e.target.getAttribute('data-page'));
            loadConversations(page);
        }
    });

    document.getElementById('conversations-body').addEventListener('click', function(e) {
        if (e.target.classList.contains('view-conversation')) {
            const conversationId = e.target.getAttribute('data-id');
            viewConversation(conversationId);
        }
    });
    createUserGrowthChart();

});

let currentPage = 1;
const perPage = 10;
const conversationList = document.getElementById('conversation-list');
const adminForm = document.getElementById('admin-form');

function isValidObjectId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id);
}

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

/**
 * Fetches and displays questions with pagination.
 *
 * @async
 * @function fetchQuestions
 * @param {number} [page=1] - The page number to fetch
 * @throws {Error} If there's an issue fetching the questions
 */
async function fetchQuestions(page = 1) {
    try {
        const response = await fetch(`/api/questions?page=${page}&per_page=${perPage}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const tableBody = document.getElementById('questions-table-body');
        if (!tableBody) {
            console.error('Questions table body not found');
            return;
        }

        populateQuestionsTable(data.questions);
        updatePagination(data);
    } catch (error) {
        console.error('Error fetching questions:', error);
        alert('Failed to fetch questions. Please try again.');
    }
}

/**
 * Populates the questions table with fetched data.
 *
 * @function populateQuestionsTable
 * @param {Array} questions - An array of question objects
 */
function populateQuestionsTable(questions) {
    const tableBody = document.getElementById('questions-table-body');
    if (!tableBody) {
        console.error('Element with ID "questions-table-body" not found. Make sure you are on the correct view.');
        return;
    }
    tableBody.innerHTML = '';
    questions.forEach(question => {
        const title = question.title || 'No title provided';
        const summary = question.summary || 'No summary provided';
        const answer = question.answer || 'No main answer provided';
        const mainAnswer = question.main_answer || answer || 'No main answer provided';
        const references = question.references || 'No references provided';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHTML(title)}</td>
            <td>${escapeHTML(question.question)}</td>
            <td>${escapeHTML(summary)}</td>
            <td>${escapeHTML(mainAnswer.split('\n').slice(0, 3).join('\n'))}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-2" 
                    data-id="${question._id}" 
                    data-question="${escapeHTML(question.question)}" 
                    data-title="${escapeHTML(title)}" 
                    data-summary="${escapeHTML(summary)}" 
                    data-answer="${escapeHTML(mainAnswer)}" 
                    data-references="${escapeHTML(references)}" 
                    onclick="showEditQuestionForm(this)">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteQuestion('${question._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * Updates the pagination controls for questions.
 *
 * @function updatePagination
 * @param {Object} data - Pagination data including total pages and current page
 */
function updatePagination(data) {
    const paginationElement = document.getElementById('questions-pagination');
    if (!paginationElement) {
        console.error('Pagination element not found');
        return;
    }

    const totalPages = data.total_pages;
    currentPage = data.page;

    let paginationHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}">
            <a class="page-link" href="#" onclick="fetchQuestions(${i}); return false;">${i}</a>
        </li>`;
    }

    paginationHTML = `
        <nav aria-label="Questions pagination">
            <ul class="pagination justify-content-center">
                <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="fetchQuestions(${currentPage - 1}); return false;">Previous</a>
                </li>
                ${paginationHTML}
                <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="fetchQuestions(${currentPage + 1}); return false;">Next</a>
                </li>
            </ul>
        </nav>
    `;

    paginationElement.innerHTML = paginationHTML;
}

/**
 * Toggles the admin status of a user.
 *
 * @async
 * @function toggleAdminStatus
 * @param {HTMLElement} button - The button element that triggered the action
 */
async function toggleAdminStatus(button) {
    const id = button.getAttribute('data-id');
    const isAdmin = button.getAttribute('data-is-admin') === 'true';
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isAdmin: !isAdmin }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        fetchUsers();
    } catch (error) {
        console.error('Error updating user:', error);
    }
}

/**
 * Fetches and displays unanswered questions.
 *
 * @async
 * @function fetchUnansweredQuestions
 * @throws {Error} If there's an issue fetching the unanswered questions
 */
async function fetchUnansweredQuestions() {
    try {
        const response = await fetch('/api/unanswered_questions');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const unansweredQuestions = await response.json();
        populateUnansweredQuestionsTable(unansweredQuestions);
    } catch (error) {
        console.error('Error fetching unanswered questions:', error);
        const tableBody = document.getElementById('unanswered-questions-table-body');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="3">Error loading unanswered questions: ${error.message}</td></tr>`;
        } else {
            console.error('Element with ID "unanswered-questions-table-body" not found.');
        }
    }
}

/**
 * Generates an answer for a given question using AI.
 *
 * @async
 * @function generateAnswer
 * @throws {Error} If there's an issue generating the answer
 */
async function generateAnswer() {
    const question = document.getElementById('question-input').value;
    if (!question) {
        alert('Please enter a question first.');
        return;
    }
    const generateBtn = document.getElementById('generate-answer-btn');
    const loader = document.getElementById('generate-loader');
    const questionInput = document.getElementById('question-input');

    if (!generateBtn || !loader || !questionInput) {
        console.error('One or more required elements not found');
        return;
    }

    try {
        loader.style.display = 'inline-block';
        generateBtn.disabled = true;

        const response = await fetch('/api/generate_answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update form fields with generated data
        const fields = ['title', 'summary', 'answer', 'references'];
        fields.forEach(field => {
            const element = document.getElementById(`${field}-input`);
            if (element) {
                element.value = data[field.replace('-', '_')] || '';
            } else {
                console.warn(`Element with id "${field}-input" not found`);
            }
        });

    } catch (error) {
        console.error('Error generating answer:', error);
        alert('An error occurred while generating the answer. Please try again.');
    } finally {
        // Hide loader and enable button
        loader.style.display = 'none';
        generateBtn.disabled = false;
    }
}

// Populate unanswered questions table with data
function populateUnansweredQuestionsTable(unansweredQuestions) {
    const tableBody = document.getElementById('unanswered-questions-table-body');
    if (!tableBody) {
        console.error('Element with ID "unanswered-questions-table-body" not found.');
        return;
    }
    tableBody.innerHTML = '';
    if (unansweredQuestions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3">No unanswered questions found.</td></tr>';
        return;
    }
    unansweredQuestions.forEach(question => {
        const questionText = question.question || 'No question provided';
        const userName = question.user_name || 'No user name provided';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHTML(questionText)}</td>
            <td>${escapeHTML(userName)}</td>
            <td>
                <button class="btn btn-sm btn-primary" 
                    data-id="${question._id}" 
                    data-answer="${question.answer}" 
                    data-title="${question.title}" 
                    data-summary="${question.summary}" 
                    data-references="${question.references}" 
                    data-question="${escapeHTML(questionText)}" 
                    onclick="showAnswerQuestionForm(this)">
                    <i class="fas fa-edit"></i> Answer
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteUnansweredQuestion('${question._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}


// Delete an unanswered question
async function deleteUnansweredQuestion(id) {
    try {
        const response = await fetch(`/api/unanswered_questions/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        fetchUnansweredQuestions();
    } catch (error) {
        console.error('Error deleting unanswered question:', error);
    }
}

/**
 * Adds a new question to the database.
 *
 * @async
 * @function addQuestion
 * @throws {Error} If there's an issue adding the question
 */
function showAddQuestionForm() {
    document.getElementById('questionModalLabel').innerText = 'Add Question';
    document.getElementById('question-input').value = '';
    document.getElementById('answer-input').value = '';  // Change this line
    const form = document.getElementById('question-form');
    form.onsubmit = async (event) => {
        event.preventDefault();
        await addQuestion();
    };
    const modal = new bootstrap.Modal(document.getElementById('question-modal'));
    modal.show();
}

/**
 * Displays the form for editing an existing question.
 *
 * @async
 * @function showEditQuestionForm
 * @param {HTMLElement} button - The button element that triggered the action
 */
async function showEditQuestionForm(button) {
    const id = button.getAttribute('data-id');
    if (!id) {
        console.error('No question ID found');
        return;
    }
    let question = button.getAttribute('data-question');
    let title = button.getAttribute('data-title');
    let summary = button.getAttribute('data-summary');
    let answer = button.getAttribute('data-answer');
    let references = button.getAttribute('data-references');


    // If we don't have all the data, fetch it
    if (!title || !summary || !answer || !references) {
        try {
            const response = await fetch(`/api/questions/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            question = data.question;
            title = data.title;
            summary = data.summary;
            answer = data.answer;
            references = data.references;
        } catch (error) {
            console.error('Error fetching question details:', error);
            alert('Failed to fetch question details. Please try again.');
            return;
        }
    }

    document.getElementById('questionModalLabel').innerText = 'Edit Question';
    document.getElementById('question-input').value = question || '';
    document.getElementById('title-input').value = title || '';
    document.getElementById('summary-input').value = summary || '';
    document.getElementById('answer-input').value = answer || '';  // Changed from mainAnswer
    document.getElementById('references-input').value = references || '';

    const form = document.getElementById('question-form');
    form.setAttribute('data-question-id', id);  // Set the ID as a data attribute
    form.onsubmit = async (event) => {
        event.preventDefault();
        await updateQuestion(id);
    };
    const modalElement = document.getElementById('question-modal');
    const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modal.show();
    window.setTimeout(() => {
        modalElement.style.display = 'block';
        modalElement.classList.add('show');
        document.body.classList.add('modal-open');

        const inputs = modalElement.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.readOnly = false;
            input.disabled = false;
        });
    }, 100);
}

// Show answer question form
function showAnswerQuestionForm(button) {
    const id = button.getAttribute('data-id');
    const questionAttr = button.getAttribute('data-question');
    const titleAttr = button.getAttribute('data-title');
    const answerAttr = button.getAttribute('data-answer');
    const summaryAttr = button.getAttribute('data-summary');
    const referencesAttr = button.getAttribute('data-references');

    const question = questionAttr ? unescapeHTML(questionAttr) : '';
    const title = titleAttr ? unescapeHTML(titleAttr) : '';
    const answer = answerAttr ? unescapeHTML(answerAttr) : '';
    const summary = summaryAttr ? unescapeHTML(summaryAttr) : '';
    const references = referencesAttr ? unescapeHTML(referencesAttr) : '';

    const questionModalLabel = document.getElementById('questionModalLabel');
    const questionInput = document.getElementById('question-input');
    const questionTitle = document.getElementById('title-input');
    const questionSummary = document.getElementById('summary-input');
    const questionReferences = document.getElementById('references-input');
    const mainAnswerInput = document.getElementById('answer-input');

    if (questionModalLabel) {
        questionModalLabel.innerText = 'Answer Question';
    } else {
        console.error('Element with ID "questionModalLabel" not found.');
    }

    if (questionInput) {
        questionInput.value = question;
    } else {
        console.error('Element with ID "question-input" not found.');
    }

    if (questionTitle) {
        questionTitle.value = title;
    } else {
        console.error('Element with ID "question-title" not found.');
    }

    if (questionSummary) {
        questionSummary.value = summary;
    } else {
        console.error('Element with ID "question-summary" not found.');
    }

    if (questionReferences) {
        questionReferences.value = references;
    } else {
        console.error('Element with ID "question-references" not found.');
    }

    if (mainAnswerInput) {
        mainAnswerInput.value = answer;
    } else {
        console.error('Element with ID "answer-input" not found.');
    }

    const form = document.getElementById('question-form');
    form.onsubmit = async (event) => {
        event.preventDefault();
        await answerQuestion(id);
    };
    const modal = new bootstrap.Modal(document.getElementById('question-modal'));
    modal.show();
}

// Add a new question
async function addQuestion() {
    const questionData = {
        question: document.getElementById('question-input').value,
        answer: document.getElementById('answer-input').value,
        title: document.getElementById('title-input').value,
        summary: document.getElementById('summary-input').value,
        references: document.getElementById('references-input').value
    };

    console.log('Sending question data:', questionData);

    try {
        const response = await fetch('/api/questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(questionData),
        });

        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || 'An unknown error occurred';
            } catch (jsonError) {
                // If the response is not JSON, use the status text
                errorMessage = response.statusText || 'An unknown error occurred';
            }
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
        }

        const result = await response.json();
        console.log('Question added:', result);
        fetchQuestions();
        const modal = bootstrap.Modal.getInstance(document.getElementById('question-modal'));
        modal.hide();
        alert('Question added successfully!');
    } catch (error) {
        console.error('Error adding question:', error);
        alert(`Failed to add question: ${error.message}`);
    }
}

/**
 * Updates an existing question in the database.
 *
 * @async
 * @function updateQuestion
 * @param {Event} event - The form submission event
 * @throws {Error} If there's an issue updating the question
 */
async function updateQuestion(event) {
    event.preventDefault();

    const form = event.target;
    const questionId = form.getAttribute('data-question-id');

    if (!questionId) {
        console.error('No question ID found');
        alert('Error: Question ID not found. Please try again.');
        return;
    }

    const questionData = {
        question: document.getElementById('question-input').value,
        title: document.getElementById('title-input').value,
        summary: document.getElementById('summary-input').value,
        answer: document.getElementById('answer-input').value,
        references: document.getElementById('references-input').value
    };

    try {
        const response = await fetch(`/api/questions/${questionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(questionData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log('Update result:', result);

        // Close the modal
        const modalElement = document.getElementById('question-modal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();

        // Refresh the questions or statistics table
        if (document.querySelector('table th').textContent.includes('Effectiveness')) {
            showAnswerFeedbackStats();
        } else {
            fetchQuestions();
        }

        alert('Question updated successfully!');
    } catch (error) {
        console.error('Error updating question:', error);
        alert('Failed to update question. Please check the console for more details.');
    }
}

// Answer an unanswered question
async function answerQuestion(id) {
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('answer-input').value;  // Change this line
    const title = document.getElementById('title-input').value;  // Change this line
    const summary = document.getElementById('summary-input').value;  // Change this line
    const references = document.getElementById('references-input').value;  // Change this line
    try {
        const response = await fetch(`/api/questions/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question, answer, title, summary, references }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        fetchUnansweredQuestions();
        const modal = bootstrap.Modal.getInstance(document.getElementById('question-modal'));
        modal.hide();
    } catch (error) {
        console.error('Error answering question:', error);
    }
}

/**
 * Deletes a question from the database.
 *
 * @async
 * @function deleteQuestion
 * @param {string} id - The ID of the question to delete
 * @throws {Error} If there's an issue deleting the question
 */
async function deleteQuestion(id) {
    if (!isValidObjectId(id)) {
        console.error('Invalid ObjectId:', id);
        alert('Invalid question ID. Please try again.');
        return;
    }

    try {
        const response = await fetch(`/api/questions/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        fetchQuestions();
    } catch (error) {
        console.error('Error deleting question:', error);
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

// User Management Functions

// Fetch and display users
async function fetchUsers() {
    try {
        const response = await fetch('/api/users');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const users = await response.json();
        populateUsersTable(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        const usersTableBody = document.getElementById('users-table-body');
        if (usersTableBody) {
            usersTableBody.innerHTML = `<tr><td colspan="4">Error loading users: ${error.message}</td></tr>`;
        }
    }
}

// Populate users table with data
function populateUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) {
        console.error('Could not find users-table-body element.');
        return;
    }
    tableBody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.last_login}</td>
            <td>${user.isAdmin ? 'Yes' : 'No'}</td>
            <td>
                <button class="btn btn-sm btn-primary" data-id="${user._id}" data-is-admin="${user.isAdmin}" onclick="toggleAdminStatus(this)">Toggle Admin</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Show edit user form
function showEditUserForm(button) {
    const id = button.getAttribute('data-id');
    const isAdmin = button.getAttribute('data-is-admin') === 'true';
    document.getElementById('user-id').value = id;
    document.getElementById('user-is-admin').checked = isAdmin;
    const modal = new bootstrap.Modal(document.getElementById('user-modal'));
    modal.show();
}

// Update user admin status
async function updateUser() {
    const id = document.getElementById('user-id').value;
    const isAdmin = document.getElementById('user-is-admin').checked;
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isAdmin }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        fetchUsers();
        const modal = bootstrap.Modal.getInstance(document.getElementById('user-modal'));
        modal.hide();
    } catch (error) {
        console.error('Error updating user:', error);
    }
}

// Display questions tab
function showQuestions() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
        <div id="questions-content">
            <h2>Questions</h2>
            <button class="btn btn-primary mb-3" onclick="showAddQuestionForm()">Add Question</button>
            <div class="table-responsive">
                <div id="questions-pagination"></div>
                <table class="table table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Question</th>
                            <th>Summary</th>
                            <th>Answer</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="questions-table-body">
                        <!-- Questions data will be populated here -->
                    </tbody>
                </table>
            </div>
            <div id="questions-pagination"></div>
        </div>
    `;
    fetchQuestions();
}

// Display unanswered questions tab
function showUnansweredQuestions() {
    const content = document.getElementById('main-content');
    if (!content) {
        console.error('Element with ID "main-content" not found.');
        return;
    }

    content.innerHTML = `
        <div id="unanswered-questions-content">
            <h2>Unanswered Questions</h2>
            <div class="table-responsive">
                <table class="table table">
                    <thead>
                        <tr>
                            <th>Question</th>
                            <th>User</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="unanswered-questions-table-body">
                        <tr><td colspan="3">Loading unanswered questions...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    fetchUnansweredQuestions();
}

/**
 * Displays user management interface and fetches user data.
 *
 * @function showUsers
 */
function showUsers() {
    const contentElement = document.getElementById('main-content');
    if (!contentElement) {
        console.error('Content element not found');
        return;
    }
    document.getElementById('main-content').innerHTML = `
        <div id="users-content">
            <h2>User Management</h2>
            <div class="table-responsive">
                <table class="table table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Last Seen</th>
                            <th>Admin</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body">
                        <tr><td colspan="4">Loading users...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    fetchUsers().catch(error => {
        console.error('Error in showUsers:', error);
        const usersTableBody = document.getElementById('users-table-body');
        if (usersTableBody) {
            usersTableBody.innerHTML = `<tr><td colspan="4">Error loading users: ${error.message}</td></tr>`;
        }
    });
}

/**
 * Fetches and displays answer feedback statistics.
 *
 * @async
 * @function showAnswerFeedbackStats
 * @throws {Error} If there's an issue fetching the statistics
 */
async function showAnswerFeedbackStats() {
    try {
        const response = await fetch('/api/answer_feedback_stats');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const stats = await response.json();

        const statsTableBody = document.getElementById('answer-feedback-stats-body');
        if (!statsTableBody) {
            console.error('answer-feedback-stats-body element not found');
            return;
        }

        if (stats.length === 0) {
            statsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No answer feedback statistics available.</td></tr>';
        } else {
            statsTableBody.innerHTML = stats.map(stat => `
                <tr>
                    <td>${escapeHTML(stat.matched_question)}</td>
                    <td>${escapeHTML(stat.original_questions)}</td>
                    <td class="text-center">${stat.total_feedback}</td>
                    <td class="text-center">${stat.positive_feedback}</td>
                    <td class="text-center">
                        <span class="badge bg-${getEffectivenessBadgeColor(stat.effectiveness)}">${stat.effectiveness.toFixed(2)}%</span>
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary me-2" 
                            data-id="${stat._id}" 
                            data-question="${escapeHTML(stat.matched_question)}" 
                            onclick="showEditQuestionForm(this)">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error fetching answer feedback stats:', error);
        const statsTableBody = document.getElementById('answer-feedback-stats-body');
        if (statsTableBody) {
            statsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading answer feedback statistics: ${error.message}</td></tr>`;
        }
    }
}

function getEffectivenessBadgeColor(effectiveness) {
    if (effectiveness >= 80) return 'success';
    if (effectiveness >= 60) return 'info';
    if (effectiveness >= 40) return 'warning';
    return 'danger';
}

async function fetchAndDisplayStatistics() {
    try {
        console.log('Fetching overall statistics...');
        const overallResponse = await fetch('/api/overall_statistics');
        if (!overallResponse.ok) {
            throw new Error(`HTTP error! status: ${overallResponse.status}`);
        }
        const overallStats = await overallResponse.json();
        console.log('Overall statistics fetched:', overallStats);

        console.log('Displaying overall statistics...');
        displayOverallStats(overallStats);

        console.log('Fetching and displaying answer feedback statistics...');
        await showAnswerFeedbackStats();
    } catch (error) {
        console.error('Error fetching statistics:', error);
        alert('An error occurred while fetching statistics. Please try again.');
    }
}

/**
 * Displays overall statistics and charts.
 *
 * @async
 * @function showStatistics
 */
async function showStatistics() {
    console.log('showStatistics called');
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }

    // Create the statistics content
    mainContent.innerHTML = `
        <h2>Statistics</h2>
        <div id="overall-stats"></div>
        <div class="card shadow-sm mt-4">
            <div class="card-body">
                <h5 class="card-title">User Growth</h5>
                <canvas id="userGrowthChart"></canvas>
            </div>
        </div>
        <div class="card shadow-sm mt-4">
            <div class="card-body">
                <h5 class="card-title mongodb-text">Answer Feedback Statistics</h5>
                <div class="table-responsive">
                    <table class="table table-hover table-striped table">
                        <thead class="table-primary">
                            <tr>
                                <th>Matched Question</th>
                                <th>Original Questions</th>
                                <th>Total Feedback</th>
                                <th>Positive Feedback</th>
                                <th>Effectiveness</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="answer-feedback-stats-body">
                            <tr><td colspan="6" class="text-center">Loading answer feedback statistics...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div id="statistics" class="tab-pane fade" role="tabpanel" aria-labelledby="statistics-tab">
    <h2>Statistics</h2>
    <div class="row mt-4 mb-4">
        <div class="col-md-12">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">Overall Statistics</h5>
                    <div id="overall-stats" class="row">
                        <!-- Overall stats will be inserted here -->
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="card shadow-sm mt-4">
        <div class="card-body">
            <h5 class="card-title">User Growth</h5>
            <canvas id="userGrowthChart"></canvas>
        </div>
    </div>
    <div class="row mt-4">
        <div class="col-md-12">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title mongodb-text">Answer Feedback Statistics</h5>
                    <div class="table-responsive">
                        <table class="table table">
                            <thead>
                                <tr>
                                    <th>Matched Question</th>
                                    <th>Original Questions</th>
                                    <th>Total Feedback</th>
                                    <th>Positive Feedback</th>
                                    <th>Effectiveness</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="statistics-table-body">
                                <tr>
                                    <td colspan="6">Loading statistics...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    `;

    // Now fetch and display the statistics
    await fetchAndDisplayStatistics();
    // Use setTimeout to ensure the DOM has updated
    setTimeout(() => {
        createUserGrowthChart();
    }, 0);
}

function displayOverallStats(stats) {
    const overallStatsContainer = document.getElementById('overall-stats');
    if (!overallStatsContainer) {
        console.error('Overall stats container not found');
        return;
    }

    overallStatsContainer.innerHTML = `
        <div class="card mb-4 shadow-sm">
            <div class="card-body">
                <h5 class="card-title">Overall Statistics</h5>
                <div class="row">
                    <div class="col-md-4 col-lg-2 mb-3">
                        <div class="stat-item">
                            <div class="stat-label">Total Users</div>
                            <div class="stat-value">${stats.total_users}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-lg-2 mb-3">
                        <div class="stat-item">
                            <div class="stat-label">Total Questions</div>
                            <div class="stat-value">${stats.total_questions}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-lg-2 mb-3">
                        <div class="stat-item">
                            <div class="stat-label">Answered Questions</div>
                            <div class="stat-value">${stats.answered_questions}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-lg-2 mb-3">
                        <div class="stat-item">
                            <div class="stat-label">Unanswered Questions</div>
                            <div class="stat-value">${stats.unanswered_questions}</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-lg-2 mb-3">
                        <div class="stat-item">
                            <div class="stat-label">Average Feedback Rating</div>
                            <div class="stat-value">${stats.average_rating} (${stats.rating_count} ratings)</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-lg-2 mb-3">
                        <div class="stat-item">
                            <div class="stat-label">Positive Answer Feedback</div>
                            <div class="stat-value">${stats.positive_feedback_percentage}%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Creates and displays the user growth chart.
 *
 * @function createUserGrowthChart
 * @throws {Error} If there's an issue creating the chart
 */
function createUserGrowthChart() {
    const canvas = document.getElementById('userGrowthChart');
    if (!canvas) {
        console.error('User growth chart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2D context for canvas');
        return;
    }

    fetch('/api/user_growth')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data || !Array.isArray(data) || data.length === 0) {
                console.error('Invalid or empty data received for user growth chart');
                return;
            }

            const validData = data.filter(item => item._id && item.count);

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: validData.map(item => new Date(item._id)),
                    datasets: [{
                        label: 'New Users',
                        data: validData.map(item => ({ x: new Date(item._id), y: item.count })),
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day'
                            },
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of New Users'
                            }
                        }
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error creating user growth chart:', error);
        });
}

function editQuestion(questionId) {
    // Fetch the question details
    fetch(`/api/questions/${questionId}`)
        .then(response => response.json())
        .then(data => {
            // Populate the existing modal with the question details
            document.getElementById('questionModalLabel').innerText = 'Edit Question';
            document.getElementById('question-input').value = data.question || '';
            document.getElementById('title-input').value = data.title || '';
            document.getElementById('summary-input').value = data.summary || '';
            document.getElementById('answer-input').value = data.answer || '';
            document.getElementById('references-input').value = data.references || '';

            // Store the question ID in a data attribute
            document.getElementById('question-form').dataset.questionId = questionId;

            // Show the modal
            const modalElement = document.getElementById('question-modal');
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        })
        .catch(error => {
            console.error('Error fetching question details:', error);
            alert('Failed to fetch question details. Please try again.');
        });
}

/**
 * Displays a list of conversations and handles pagination.
 *
 * @function showConversations
 */
function showConversations() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }

    // Clear existing content
    mainContent.innerHTML = '';

    // Create conversations container
    const conversationsContainer = document.createElement('div');
    conversationsContainer.id = 'conversations';
    conversationsContainer.innerHTML = `
        <h2>Conversations</h2>
        <div id="conversations-table" class="table-responsive">
            <table class="table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Last Updated</th>
                        <th>Preview</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="conversations-body">
                </tbody>
            </table>
        </div>
        <nav aria-label="Conversations pagination">
            <ul class="pagination" id="conversations-pagination">
            </ul>
        </nav>
    `;

    mainContent.appendChild(conversationsContainer);

    // Load the first page of conversations
    loadConversations(1);
}

/**
 * Loads a specific page of conversations.
 *
 * @function loadConversations
 * @param {number} page - The page number to load
 */
function loadConversations(page) {
    fetch(`/api/conversations?page=${page}&per_page=10`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const tableBody = document.getElementById('conversations-body');
            if (!tableBody) {
                console.error('Conversations table body not found');
                return;
            }
            tableBody.innerHTML = '';

            data.conversations.forEach(conv => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHTML(conv.user_name)}</td>
                    <td>${conv.last_updated === 'Unknown' ? 'Unknown' : new Date(conv.last_updated).toLocaleString()}</td>
                    <td>${conv.preview.map(escapeHTML).join('<br>')}</td>
                    <td>
                        <button class="btn btn-sm btn-primary view-conversation" data-id="${conv._id}">View</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });

            updateConversationPagination(data.page, data.total_pages);
        })
        .catch(error => {
            console.error('Error loading conversations:', error);
            const tableBody = document.getElementById('conversations-body');
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="4">Error loading conversations: ${escapeHTML(error.message)}</td></tr>`;
            }
        });
}

function updateConversationPagination(currentPage, totalPages) {
    const pagination = document.getElementById('conversations-pagination');
    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        pagination.appendChild(li);
    }
}

/**
 * Displays details of a specific conversation.
 *
 * @function viewConversation
 * @param {string} conversationId - The ID of the conversation to view
 */
function viewConversation(conversationId) {
    fetch(`/api/conversations/${conversationId}`)
        .then(response => response.json())
        .then(data => {
            const modalContent = `
                <div class="modal-header">
                    <h5 class="modal-title">Conversation Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p><strong>User Name:</strong> ${escapeHTML(data.user_name)}</p>
                    <p><strong>Last Updated:</strong> ${data.last_updated === 'Unknown' ? 'Unknown' : new Date(data.last_updated).toLocaleString()}</p>
                    <h6>Messages:</h6>
                    <ul>
                        ${data.messages.map(msg => `<li><strong>${escapeHTML(msg.role)}:</strong> ${escapeHTML(msg.content)}</li>`).join('')}
                    </ul>
                </div>
            `;

            const modalElement = document.getElementById('conversationModal') || createConversationModal();
            modalElement.querySelector('.modal-content').innerHTML = modalContent;

            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        })
        .catch(error => {
            console.error('Error viewing conversation:', error);
            alert('Failed to load conversation details. Please try again.');
        });
}
function createConversationModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'conversationModal';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = '<div class="modal-dialog modal-lg"><div class="modal-content"></div></div>';
    document.body.appendChild(modal);
    return modal;
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