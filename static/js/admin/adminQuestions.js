let currentPage = 1;
const perPage = 10;
import { escapeHTML, showError, unescapeHTML } from './utils.js';
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

function createTableRow(cells) {
    const row = document.createElement('tr');
    cells.forEach(cell => {
        const td = document.createElement('td');
        td.innerHTML = cell;
        row.appendChild(td);
    });
    return row;
}

/**
 * Fetches and displays questions with pagination.
 *
 * @async
 * @function fetchQuestions
 * @param {number} [page=1] - The page number to fetch
 * @throws {Error} If there's an issue fetching the questions
 */
export async function fetchQuestions(page = 1) {
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
        showError('Failed to fetch questions. Please try again.');
    }
}
/**
 * Populates the questions table with fetched data.
 *
 * @function populateQuestionsTable
 * @param {Array} questions - An array of question objects
 */
export function populateQuestionsTable(questions) {
    console.log('Received questions:', questions);

    const tableBody = document.getElementById('questions-table-body');
    if (!tableBody) {
        console.error('Element with ID "questions-table-body" not found. Make sure you are on the correct view.');
        return;
    }
    tableBody.innerHTML = '';
    questions.forEach(question => {
        const title = truncateText(question.title || 'No title provided');
        const summary = truncateText(question.summary || 'No summary provided');
        const answer = truncateText(question.answer || question.main_answer || 'No answer provided');
        const module = truncateText(question.module || 'N/A');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHTML(title)}</td>
            <td>${escapeHTML(truncateText(question.question))}</td>
            <td>${escapeHTML(summary)}</td>
            <td>${escapeHTML(answer)}</td>
            <td>${escapeHTML(module)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-2 edit-question-btn" 
                    data-id="${question._id}" 
                    data-question="${escapeHTML(question.question)}" 
                    data-title="${escapeHTML(question.title || '')}" 
                    data-summary="${escapeHTML(question.summary || '')}" 
                    data-answer="${escapeHTML(question.answer || '')}" 
                    data-references="${escapeHTML(question.references || '')}"
                    data-is-workshop-content="${question.is_workshop_content}"
                    data-workshop-keywords="${escapeHTML(question.workshop_keywords || '')}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger delete-question-btn" data-id="${question._id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    addQuestionTableEventListeners();
}
function addQuestionTableEventListeners() {
    const editButtons = document.querySelectorAll('.edit-question-btn');
    const deleteButtons = document.querySelectorAll('.delete-question-btn');

    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            showEditQuestionForm(this);
        });
    });

    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            deleteQuestion(this.getAttribute('data-id'));
        });
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
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link pagination-link" href="#" data-page="${i}">${i}</a>
            </li>`;
    }

    paginationHTML = `
        <nav aria-label="Questions pagination">
            <ul class="pagination justify-content-center">
                <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                    <a class="page-link pagination-link" href="#" data-page="${currentPage - 1}">Previous</a>
                </li>
                ${paginationHTML}
                <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link pagination-link" href="#" data-page="${currentPage + 1}">Next</a>
                </li>
            </ul>
        </nav>
    `;

    paginationElement.innerHTML = paginationHTML;
    addPaginationEventListeners();
}

function addPaginationEventListeners() {
    const paginationLinks = document.querySelectorAll('.pagination-link');
    paginationLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const page = parseInt(this.getAttribute('data-page'));
            if (!isNaN(page)) {
                fetchQuestions(page);
            }
        });
    });
}
/**
* Searches for questions based on the input query.
* @async
* @function searchQuestions
* @throws {Error} If there's an issue searching for questions
*/
export async function searchQuestions() {
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
/**
* Displays the unanswered questions tab.
* @function showUnansweredQuestions
*/
export function showUnansweredQuestions() {
    const content = document.getElementById('main-content');
    if (!content) {
        console.error('Element with ID "main-content" not found.');
        return;
    }

    content.innerHTML = `
        <div id="unanswered-questions-content">
            <h2>Unanswered Questions</h2>
                <div class="table-responsive mt-3">
                <table class="table table-bordered table-striped">
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
 * Displays the questions tab and sets up the search functionality.
 * @function showQuestions
 */
export function showQuestions() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
        <div id="questions-content">
            <h2>Questions</h2>
            <div class="mb-3">
                <input type="text" id="question-search" class="form-control" placeholder="Search questions...">
            </div>
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
                            <th>Module</th>
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
    const searchInput = document.getElementById('question-search');
    searchInput.addEventListener('input', debounce(searchQuestions, 300));
    fetchQuestions();
}

/**
 * Fetches and displays unanswered questions.
 *
 * @async
 * @function fetchUnansweredQuestions
 * @throws {Error} If there's an issue fetching the unanswered questions
 */
export async function fetchUnansweredQuestions() {
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
export async function generateAnswer() {
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

/**
 * Populates the unanswered questions table with data.
 * @function populateUnansweredQuestionsTable
 * @param {Array} unansweredQuestions - An array of unanswered question objects
 */
export function populateUnansweredQuestionsTable(unansweredQuestions) {
    const tableBody = document.getElementById('unanswered-questions-table-body');
    if (!tableBody) {
        console.error('Element with ID "unanswered-questions-table-body" not found.');
        return;
    }
    tableBody.innerHTML = '';
    if (unansweredQuestions.length === 0) {
        tableBody.appendChild(createTableRow(['<td colspan="3">No unanswered questions found.</td>']));
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
                <button class="btn btn-sm btn-primary answer-question" 
                    data-id="${question._id}" 
                    data-answer="${question.answer}" 
                    data-title="${question.title}" 
                    data-summary="${question.summary}" 
                    data-references="${question.references}" 
                    data-question="${escapeHTML(questionText)}">
                    <i class="fas fa-edit"></i> Answer
                </button>
                <button class="btn btn-sm btn-danger delete-unanswered-question" data-id="${question._id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Add event listeners after populating the table
    addUnansweredQuestionEventListeners();
}

function addUnansweredQuestionEventListeners() {
    const answerButtons = document.querySelectorAll('.answer-question');
    const deleteButtons = document.querySelectorAll('.delete-unanswered-question');

    answerButtons.forEach(button => {
        button.addEventListener('click', function() {
            showAnswerQuestionForm(this);
        });
    });

    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            deleteUnansweredQuestion(this.getAttribute('data-id'));
        });
    });
}
/**
 * Deletes an unanswered question from the database.
 * @async
 * @function deleteUnansweredQuestion
 * @param {string} id - The ID of the unanswered question to delete
 * @throws {Error} If there's an issue deleting the unanswered question
 */
export async function deleteUnansweredQuestion(id) {
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
 * Shows the form for adding a new question.
 * @function showAddQuestionForm
 */
export function showAddQuestionForm() {
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
 * @async
 * @function showEditQuestionForm
 * @param {HTMLElement} button - The button element that triggered the action
 * @throws {Error} If there's an issue fetching question details
 */
export async function showEditQuestionForm(button) {
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
    let isWorkshopContent = button.getAttribute('data-is-workshop-content') === 'true';
    let workshopKeywords = button.getAttribute('data-workshop-keywords');


    // If we don't have all the data, fetch it
    if (!title || !summary || !answer || !references || isWorkshopContent === undefined || !workshopKeywords) {
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
            isWorkshopContent = data.is_workshop_content;
            workshopKeywords = data.workshop_keywords;
        } catch (error) {
            console.error('Error fetching question details:', error);
            showError('Failed to fetch question details. Please try again.');
            return;
        }
    }

    document.getElementById('questionModalLabel').innerText = 'Edit Question';
    document.getElementById('question-input').value = question || '';
    document.getElementById('title-input').value = title || '';
    document.getElementById('summary-input').value = summary || '';
    document.getElementById('answer-input').value = answer || '';
    document.getElementById('references-input').value = references || '';
    document.getElementById('is-workshop-content-input').checked = isWorkshopContent;
    document.getElementById('workshop-keywords-input').value = workshopKeywords || '';


    const form = document.getElementById('question-form');
    form.setAttribute('data-question-id', id);
    form.onsubmit = function (event) {
        event.preventDefault();
        const questionId = this.getAttribute('data-question-id');
        updateQuestion(questionId);
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

/**
 * Shows the form for answering an unanswered question.
 * @function showAnswerQuestionForm
 * @param {HTMLElement} button - The button element that triggered the action
 */
export function showAnswerQuestionForm(button) {
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

/**
 * Adds a new question to the database.
 * @async
 * @function addQuestion
 * @throws {Error} If there's an issue adding the question
 */
export async function addQuestion() {
    const questionData = {
        question: document.getElementById('question-input').value,
        answer: document.getElementById('answer-input').value,
        title: document.getElementById('title-input').value,
        summary: document.getElementById('summary-input').value,
        references: document.getElementById('references-input').value,
        is_workshop_content: document.getElementById('is-workshop-content-input').checked,
        workshop_keywords: document.getElementById('workshop-keywords-input').value
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
 * @async
 * @function updateQuestion
 * @param {string} questionId - The ID of the question to update
 * @throws {Error} If there's an issue updating the question
 */
export async function updateQuestion(questionId) {
    if (!questionId || typeof questionId !== 'string') {
        console.error('Invalid question ID:', questionId);
        alert('Error: Invalid question ID. Please try again.');
        return;
    }

    const questionData = {
        question: document.getElementById('question-input').value,
        title: document.getElementById('title-input').value,
        summary: document.getElementById('summary-input').value,
        answer: document.getElementById('answer-input').value,
        references: document.getElementById('references-input').value,
        is_workshop_content: document.getElementById('is-workshop-content-input').checked,
        workshop_keywords: document.getElementById('workshop-keywords-input').value
    };

    try {
        console.log(`Updating question with ID: ${questionId}`);
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

        // Refresh the questions table
        fetchQuestions();

        alert('Question updated successfully!');
    } catch (error) {
        console.error('Error updating question:', error);
        alert('Failed to update question. Please check the console for more details.');
    }
}
/**
 * Answers an unanswered question.
 * @async
 * @function answerQuestion
 * @param {string} id - The ID of the question to answer
 * @throws {Error} If there's an issue answering the question
 */
export async function answerQuestion(id) {
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
 * @async
 * @function deleteQuestion
 * @param {string} id - The ID of the question to delete
 * @throws {Error} If there's an issue deleting the question
 */
export async function deleteQuestion(id) {
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


                let resultsHtml = '<div class="table-responsive mt-3"><table class="table table-bordered table-striped"><thead><tr><th>Question</th><th>Title</th><th>Answer Preview</th><th>Score</th></tr></thead><tbody>';
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
                resultsHtml += '</tbody></table></div>';
                searchResults.innerHTML = resultsHtml;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            searchResults.innerHTML = '<p class="text-danger">An error occurred while searching</p>';
        });
});



const unansweredQuestionsTab = document.querySelector('[onclick="showUnansweredQuestions()"]');
if (unansweredQuestionsTab) {
    unansweredQuestionsTab.removeAttribute('onclick');
    unansweredQuestionsTab.addEventListener('click', showUnansweredQuestions);
} else {
    console.error('Unanswered questions tab not found');
}
export function isValidObjectId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id);
}
export function truncateText(text, maxLength = 50) {
    if (text && text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text || '';
}
