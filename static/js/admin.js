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
});

let currentPage = 1;
const perPage = 10;

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

// Fetch and display questions
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

// Populate questions table with data
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
            <td>
                <button class="btn btn-sm btn-primary" 
                    data-id="${question._id}" 
                    data-question="${escapeHTML(question.question)}" 
                    data-title="${escapeHTML(title)}" 
                    data-summary="${escapeHTML(summary)}" 
                    data-answer="${escapeHTML(answer)}" 
                    data-references="${escapeHTML(references)}" 
                    onclick="showEditQuestionForm(this)">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${question._id}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

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
// Toggle admin status for a user
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

// Fetch and display unanswered questions
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
// Add this function to your admin.js file
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
                    data-question="${escapeHTML(questionText)}" 
                    onclick="showAnswerQuestionForm(this)">Answer</button>
                <button class="btn btn-sm btn-danger" onclick="deleteUnansweredQuestion('${question._id}')">Delete</button>
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

// Show add question form
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

// Show edit question form
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
            mainAnswer = data.answer;
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
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`);
        }

        const result = await response.json();
        console.log('Question added:', result);
        fetchQuestions();
        const modal = bootstrap.Modal.getInstance(document.getElementById('question-modal'));
        modal.hide();
    } catch (error) {
        console.error('Error adding question:', error);
        alert(`Failed to add question: ${error.message}`);
    }
}

// Update an existing question
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

// Delete a question
async function deleteQuestion(id) {
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
                <table class="table table-bordered">
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
                <table class="table table-bordered">
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

// Display users tab
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
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
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
                        <button class="btn btn-sm btn-outline-primary" 
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
                <h5 class="card-title text-primary">Answer Feedback Statistics</h5>
                <div class="table-responsive">
                    <table class="table table-hover table-striped table-bordered">
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
    `;

    // Now fetch and display the statistics
    await fetchAndDisplayStatistics();
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
                <h5 class="card-title mongodb-text">Overall Statistics</h5>
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
                    <div class="col-md-6 col-lg-3 mb-3">
                        <div class="stat-item">
                            <div class="stat-label">Unanswered Questions</div>
                            <div class="stat-value">${stats.unanswered_questions}</div>
                        </div>
                    </div>
                    <div class="col-md-6 col-lg-3 mb-3">
                        <div class="stat-item">
                            <div class="stat-label">Average Feedback Rating</div>
                            <div class="stat-value">${stats.average_rating}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
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

async function updateQuestion(event) {
    event.preventDefault(); // Prevent form submission

    const form = event.target;
    const questionId = form.dataset.questionId;

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
        const responseData = await response.json();

        if (!response.ok) {
            console.error('Server response:', responseData);
            throw new Error(`HTTP error! status: ${response.status}, message: ${responseData.error}`);
        }

        console.log('Update result:', responseData);

        if (responseData.new_id) {
            console.log('Question moved to answered collection with new ID:', responseData.new_id);
            // You might want to update the UI or perform additional actions here
        }


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
        alert('Failed to update question. Please try again.');
    }
}
