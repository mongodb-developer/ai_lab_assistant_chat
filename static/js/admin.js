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
});

// Fetch and display questions
async function fetchQuestions() {
    try {
        const response = await fetch('/api/questions');
        console.log('Fetch response:', response);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response text:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const questions = await response.json();
        console.log('Fetched questions:', questions);
        populateQuestionsTable(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
        const content = document.getElementById('content');
        if (content) {
            content.innerHTML += `<p class="error-message">Error loading questions: ${error.message}</p>`;
        }
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
                    data-answer="${escapeHTML(mainAnswer)}" 
                    data-references="${escapeHTML(references)}" 
                    onclick="showEditQuestionForm(this)">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${question._id}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
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
    }
}
// Add this function to your admin.js file
async function generateAnswer() {
    const question = document.getElementById('question-input').value;
    if (!question) {
        alert('Please enter a question first.');
        return;
    }

    try {
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

        document.getElementById('title-input').value = data.title;
        document.getElementById('summary-input').value = data.summary;
        document.getElementById('main-answer-input').value = data.answer;
        document.getElementById('references-input').value = data.references;

    } catch (error) {
        console.error('Error generating answer:', error);
        alert('An error occurred while generating the answer. Please try again.');
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
    unansweredQuestions.forEach(question => {
        console.log('Processing question:', question);
        
        const questionText = question.question || 'No question provided';
        const userName = question.user_name || 'No user name provided';
        const title = question.title || 'No title provided';
        const summary = question.summary || 'No summary provided';
        const references = question.references || 'No references provided';
        const answer = question.answer || 'No answer provided';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHTML(questionText)}</td>
            <td>${escapeHTML(userName)}</td>
            <td>
                <button class="btn btn-sm btn-primary" 
                    data-id="${question._id}" 
                    data-question="${escapeHTML(questionText)}" 
                    data-title="${escapeHTML(title)}" 
                    data-summary="${escapeHTML(summary)}" 
                    data-references="${escapeHTML(references)}" 
                    data-answer="${escapeHTML(answer)}" 
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
    document.getElementById('main-answer-input').value = '';  // Change this line
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
    let question = button.getAttribute('data-question');
    let title, summary, mainAnswer, references;

    // If we don't have all the data, fetch it
    if (!title || !summary || !mainAnswer || !references) {
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
    document.getElementById('question-input').value = question;
    document.getElementById('title-input').value = title || '';
    document.getElementById('summary-input').value = summary || '';
    document.getElementById('main-answer-input').value = mainAnswer || '';
    document.getElementById('references-input').value = references || '';

    const form = document.getElementById('question-form');
    form.onsubmit = async (event) => {
        event.preventDefault();
        await updateQuestion(id);
    };
    const modal = new bootstrap.Modal(document.getElementById('question-modal'));
    modal.show();
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
    const mainAnswerInput = document.getElementById('main-answer-input');

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
        console.error('Element with ID "main-answer-input" not found.');
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
        answer: document.getElementById('main-answer-input').value,
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
async function updateQuestion(id) {
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('main-answer-input').value;
    const title = document.getElementById('title-input').value;
    const summary = document.getElementById('summary-input').value;
    const references = document.getElementById('references-input').value;
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
        
        // Check which view we're in and refresh accordingly
        if (document.querySelector('table th').textContent.includes('Effectiveness')) {
            showAnswerFeedbackStats();
        } else {
            fetchQuestions();
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('question-modal'));
        modal.hide();
    } catch (error) {
        console.error('Error updating question:', error);
        alert('Failed to update question. Please try again.');
    }
}

// Answer an unanswered question
async function answerQuestion(id) {
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('main-answer-input').value;  // Change this line
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
        // Display error message to the user
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
    const content = document.getElementById('content');
    content.innerHTML = `
        <div id="questions-content">
            <h2>Questions</h2>
            <button class="btn btn-primary mb-3" onclick="showAddQuestionForm()">Add Question</button>
            <div class="table-responsive">
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
        </div>
    `;
    fetchQuestions();
}

// Display unanswered questions tab
function showUnansweredQuestions() {
    document.getElementById('content').innerHTML = `
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
                        <!-- Unanswered questions data will be populated here -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    fetchUnansweredQuestions();
}

// Display users tab
function showUsers() {
    document.getElementById('content').innerHTML = `
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
        
        const content = document.getElementById('content');
        content.innerHTML = `
        <h2>Answer Feedback Statistics</h2>
        <table class="table">
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
            <tbody>
                ${stats.map(stat => `
                    <tr>
                        <td>${escapeHTML(stat.matched_question)}</td>
                        <td>${escapeHTML(stat.original_questions)}</td>
                        <td>${stat.total_feedback}</td>
                        <td>${stat.positive_feedback}</td>
                        <td>${stat.effectiveness.toFixed(2)}%</td>
                        <td>
                            <button class="btn btn-sm btn-primary" 
                                data-id="${stat._id}" 
                                data-question="${escapeHTML(stat.matched_question)}" 
                                onclick="showEditQuestionForm(this)">Edit</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        `;
    } catch (error) {
        console.error('Error fetching answer feedback stats:', error);
        const content = document.getElementById('content');
        content.innerHTML = `<p>Error loading answer feedback statistics: ${error.message}</p>`;
    }
}

function editQuestion(questionId) {
    // Fetch the question details
    fetch(`/api/questions/${questionId}`)
        .then(response => response.json())
        .then(data => {
            // Populate a modal with the question details
            const modal = document.getElementById('editQuestionModal');
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Question</h5>
                            <button type="button" class="close" data-dismiss="modal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <form id="editQuestionForm">
                                <div class="form-group">
                                    <label for="questionText">Question:</label>
                                    <input type="text" class="form-control" id="questionText" value="${escapeHTML(data.question)}">
                                </div>
                                <div class="form-group">
                                    <label for="answerText">Answer:</label>
                                    <textarea class="form-control" id="answerText">${escapeHTML(data.answer)}</textarea>
                                </div>
                                <button type="submit" class="btn btn-primary">Save Changes</button>
                            </form>
                        </div>
                    </div>
                </div>
            `;
            
            // Show the modal
            $(modal).modal('show');

            // Handle form submission
            document.getElementById('editQuestionForm').onsubmit = function(e) {
                e.preventDefault();
                updateQuestion(questionId);
            };
        });
}

function updateQuestion(questionId) {
    const updatedQuestion = document.getElementById('questionText').value;
    const updatedAnswer = document.getElementById('answerText').value;

    fetch(`/api/questions/${questionId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            question: updatedQuestion,
            answer: updatedAnswer,
        }),
    })
    .then(response => response.json())
    .then(data => {
        alert('Question updated successfully');
        $('#editQuestionModal').modal('hide');
        showAnswerFeedbackStats(); // Refresh the stats
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to update question');
    });
}
