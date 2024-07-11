var answerEditor;

document.addEventListener('DOMContentLoaded', () => {
    answerEditor = new EasyMDE({
        element: document.getElementById('answerEditor'),
        spellChecker: false
    });

    fetchQuestions();
    fetchUnansweredQuestions();
});

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
            <td>${question.question}</td>
            <td>${truncateText(question.answer, 100)}</td>
            <td>
                <button class="btn btn-sm btn-primary" data-id="${question._id}" data-question="${escapeHTML(question.question)}" data-answer="${escapeHTML(question.answer)}" onclick="showEditQuestionForm(this)">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${question._id}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}


function truncateText(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text;
}


function populateUnansweredQuestionsTable(unansweredQuestions) {
    const tableBody = document.getElementById('unanswered-questions-table-body');
    tableBody.innerHTML = '';
    unansweredQuestions.forEach(question => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${question.question}</td>
            <td>${question.user_name}</td>
            <td>
                <button class="btn btn-sm btn-primary" data-id="${question._id}" data-question="${escapeHTML(question.question)}" onclick="showAnswerQuestionForm(this)">Answer</button>
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
            <td>${question.question}</td>
            <td>${question.user_name}</td>
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
    answerEditor.value('');
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
    answerEditor.value(answer);  // Set the value of EasyMDE editor

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
    answerEditor.value('');  // Clear the value of EasyMDE editor

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
    const answer = answerEditor.value();
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
    const answer = answerEditor.value();
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
    const answer = answerEditor.value();
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
        '&': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&#39;': "'",
        '&quot;': '"'
    }[tag] || tag));
}
