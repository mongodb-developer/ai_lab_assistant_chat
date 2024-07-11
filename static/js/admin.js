// admin.js

document.addEventListener('DOMContentLoaded', fetchQuestions);
document.addEventListener('DOMContentLoaded', fetchUnansweredQuestions);

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

function populateQuestionsTable(questions) {
    const tableBody = document.getElementById('questions-table-body');
    tableBody.innerHTML = '';
    questions.forEach(question => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHTML(question.question)}</td>
            <td>${escapeHTML(question.answer)}</td>
            <td>
                <button class="btn btn-sm btn-primary" data-id="${question._id}" data-question="${escapeHTML(question.question)}" data-answer="${escapeHTML(question.answer)}" onclick="showEditQuestionForm(this)">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${question._id}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

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

function populateUnansweredQuestionsTable(unansweredQuestions) {
    const tableBody = document.getElementById('unanswered-questions-table-body');
    tableBody.innerHTML = '';
    unansweredQuestions.forEach(question => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHTML(question.question)}</td>
            <td>${escapeHTML(question.user_id)}</td>
            <td>
                <button class="btn btn-sm btn-primary" data-id="${question._id}" data-question="${escapeHTML(question.question)}" onclick="showAnswerQuestionForm(this)">Answer</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function showAddQuestionForm() {
    document.getElementById('questionModalLabel').innerText = 'Add Question';
    document.getElementById('question-input').value = '';
    document.getElementById('answer-input').value = '';
    const form = document.getElementById('question-form');
    form.onsubmit = async (event) => {
        event.preventDefault();
        await addQuestion();
    };
    const modal = new bootstrap.Modal(document.getElementById('question-modal'));
    modal.show();
}

function showEditQuestionForm(button) {
    const id = button.getAttribute('data-id');
    const question = unescapeHTML(button.getAttribute('data-question'));
    const answer = unescapeHTML(button.getAttribute('data-answer'));
    document.getElementById('questionModalLabel').innerText = 'Edit Question';
    document.getElementById('question-input').value = question;
    document.getElementById('answer-input').value = answer;
    const form = document.getElementById('question-form');
    form.onsubmit = async (event) => {
        event.preventDefault();
        await updateQuestion(id);
    };
    const modal = new bootstrap.Modal(document.getElementById('question-modal'));
    modal.show();
}

function showAnswerQuestionForm(button) {
    const id = button.getAttribute('data-id');
    const question = unescapeHTML(button.getAttribute('data-question'));
    document.getElementById('questionModalLabel').innerText = 'Answer Question';
    document.getElementById('question-input').value = question;
    document.getElementById('answer-input').value = '';
    const form = document.getElementById('question-form');
    form.onsubmit = async (event) => {
        event.preventDefault();
        await answerQuestion(id);
    };
    const modal = new bootstrap.Modal(document.getElementById('question-modal'));
    modal.show();
}

async function addQuestion() {
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('answer-input').value;
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

async function updateQuestion(id) {
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('answer-input').value;
    try {
        const response = await fetch(`/api/questions/${id}`, {
            method: 'PUT',
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
        console.error('Error updating question:', error);
    }
}

async function answerQuestion(id) {
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('answer-input').value;
    try {
        const response = await fetch(`/api/questions/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question, answer }),
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

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function unescapeHTML(str) {
    return str.replace(/&amp;|&lt;|&gt;|&#39;|&quot;/g, tag => ({
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&#39;': "'",
        '&quot;': '"'
    }[tag] || tag));
}
