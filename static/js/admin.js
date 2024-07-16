document.addEventListener('DOMContentLoaded', () => {
    fetchQuestions();
    fetchUnansweredQuestions();
    fetchUsers();
    showQuestions();
});

// Fetch and display questions
async function fetchQuestions() {
    try {
        const response = await fetch('/api/questions');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const questions = await response.json();
        populateQuestionsTable(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
    }
}

// Populate questions table with data
function populateQuestionsTable(questions) {
    const tableBody = document.getElementById('questions-table-body');
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
function showEditQuestionForm(button) {
    const id = button.getAttribute('data-id');
    const question = unescapeHTML(button.getAttribute('data-question'));
    const title = unescapeHTML(button.getAttribute('data-title'));
    const summary = unescapeHTML(button.getAttribute('data-summary'));
    const mainAnswer = unescapeHTML(button.getAttribute('data-answer'));
    const references = unescapeHTML(button.getAttribute('data-references'));

    document.getElementById('questionModalLabel').innerText = 'Edit Question';
    document.getElementById('question-input').value = question;
    document.getElementById('title-input').value = title;
    document.getElementById('summary-input').value = summary;
    document.getElementById('main-answer-input').value = mainAnswer;  // Change this line
    document.getElementById('references-input').value = references;

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
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('main-answer-input').value;  // Change this line
    try {
        const response = await fetch('/api/questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question, answer }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        fetchQuestions();
        const modal = bootstrap.Modal.getInstance(document.getElementById('question-modal'));
        modal.hide();
    } catch (error) {
        console.error('Error adding question:', error);
    }
}

// Update an existing question
async function updateQuestion(id) {
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
        fetchQuestions();
        const modal = bootstrap.Modal.getInstance(document.getElementById('question-modal'));
        modal.hide();
    } catch (error) {
        console.error('Error updating question:', error);
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
    document.getElementById('content').innerHTML = `
        <div id="questions-content">
            <h2>Questions</h2>
            <button class="btn btn-primary mb-3" onclick="showAddQuestionForm()">Add Question</button>
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Title</th>
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
    fetchQuestions();
    fetchUnansweredQuestions();
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
                        <!-- User data will be populated here -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    fetchUsers();
}
