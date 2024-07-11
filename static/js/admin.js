document.addEventListener('DOMContentLoaded', fetchQuestions);

async function fetchQuestions() {
    try {
        const response = await fetch('/api/questions', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const questions = await response.json();
        displayQuestions(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
    }
}

function displayQuestions(questions) {
    const questionsTableBody = document.getElementById('questions-table-body');
    questionsTableBody.innerHTML = '';
    questions.forEach(question => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${question.question}</td>
            <td>${question.answer}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="showEditQuestionForm('${question._id}', '${question.question}', '${question.answer}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${question._id}')">Delete</button>
            </td>
        `;
        questionsTableBody.appendChild(tr);
    });
}

function showAddQuestionForm() {
    document.getElementById('questionModalLabel').textContent = 'Add Question';
    document.getElementById('question-form').reset();
    document.getElementById('question-id').value = '';
    const questionModal = new bootstrap.Modal(document.getElementById('questionModal'));
    questionModal.show();
}

function showEditQuestionForm(id, question, answer) {
    document.getElementById('questionModalLabel').textContent = 'Edit Question';
    document.getElementById('question-id').value = id;
    document.getElementById('question-input').value = question;
    document.getElementById('answer-input').value = answer;
    const questionModal = new bootstrap.Modal(document.getElementById('questionModal'));
    questionModal.show();
}

document.getElementById('question-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('question-id').value;
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('answer-input').value;

    const endpoint = id ? `/api/questions/${id}` : '/api/questions';
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question, answer }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        alert(result.message);
        fetchQuestions();
        const questionModal = bootstrap.Modal.getInstance(document.getElementById('questionModal'));
        questionModal.hide();
    } catch (error) {
        console.error('Error:', error);
        alert(`An error occurred: ${error.message}`);
    }
});

async function deleteQuestion(id) {
    if (!confirm('Are you sure you want to delete this question?')) {
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

        const result = await response.json();
        alert(result.message);
        fetchQuestions(); // Refresh the questions list
    } catch (error) {
        console.error('Error deleting question:', error);
        alert(`An error occurred: ${error.message}`);
    }
}
