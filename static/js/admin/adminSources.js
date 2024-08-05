
/**
 * Displays the question sources interface and sets up the forms.
 * @function
 * @name showQuestionSources
 */
export function showQuestionSources() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }

    // Clear existing content
    mainContent.innerHTML = '';

    // Create question sources container
    const questionSourcesContainer = document.createElement('div');
    questionSourcesContainer.id = 'question-sources';
    questionSourcesContainer.innerHTML = `
        <h2>Add Questions from Sources</h2>

        <div class="alert alert-info" role="alert">
                <p>This feature allows you to easily import questions and answers from various sources, enhancing your knowledge base efficiently.</p>
                <hr>
                <p class="mb-0">You can:</p>
                <ul>
                    <li>Upload and process files (PPTX, DOCX, TXT) to extract questions and answers.</li>
                    <li>Process content from a URL to generate questions and answers.</li>
                    <li>Set similarity thresholds to avoid duplicate entries.</li>
                </ul>
                <p>This tool uses AI to analyze the content and create relevant question-answer pairs, which are then added to your database.</p>
            </div>
            <div class="row">
        <div class="col-md-6">
            <h3>Upload Files</h3>u
            <form id="file-upload-form" enctype="multipart/form-data">
                <div class="mb-3">
                    <label for="file-input" class="form-label">Select files (PPTX, DOCX, TXT)</label>
                    <input type="file" class="form-control" id="file-input" name="files" multiple accept=".pptx,.docx,.txt">
                </div>
                <div class="mb-3">
                    <label for="file-similarity-threshold" class="form-label">Similarity Threshold (0-1)</label>
                    <input type="number" class="form-control" id="file-similarity-threshold" name="similarity_threshold" min="0" max="1" step="0.01" value="0.9">
                </div>
                <button type="submit" class="btn btn-primary">Upload and Process</button>
            </form>
        </div>
        <div class="col-md-6">
            <h3>Process URL</h3>
            <form id="url-process-form">
                <div class="mb-3">
                    <label for="url-input" class="form-label">Enter URL</label>
                    <input type="url" class="form-control" id="url-input" name="url" required>
                </div>
                <div class="mb-3">
                    <label for="url-similarity-threshold" class="form-label">Similarity Threshold (0-1)</label>
                    <input type="number" class="form-control" id="url-similarity-threshold" name="similarity_threshold" min="0" max="1" step="0.01" value="0.9">
                </div>
                <button type="submit" class="btn btn-primary">Process URL</button>
            </form>
        </div>
    </div>
        `;
    mainContent.appendChild(questionSourcesContainer);
    // Set up the forms
    setupQuestionSourcesForms();
}

/**
 * Sets up event listeners for file upload and URL processing forms.
 * @function
 * @name setupQuestionSourcesForms
 */
export function setupQuestionSourcesForms() {
    const fileUploadForm = document.getElementById('file-upload-form');
    const urlProcessForm = document.getElementById('url-process-form');
    const processingStatus = document.getElementById('processing-status');

    fileUploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(fileUploadForm);
        try {
            const response = await fetch('/api/process_files', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            processingStatus.innerHTML = `<div class="alert alert-success">Files processed successfully. ${result.questionsAdded} new questions added.</div>`;
        } catch (error) {
            processingStatus.innerHTML = `<div class="alert alert-danger">Error processing files: ${error.message}</div>`;
        }
    });

    urlProcessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('url-input').value;
        const similarityThreshold = document.getElementById('url-similarity-threshold').value;
        try {
            const response = await fetch('/api/process_url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, similarity_threshold: similarityThreshold })
            });
            const result = await response.json();
            processingStatus.innerHTML = `<div class="alert alert-success">URL processed successfully. ${result.questionsAdded} new questions added.</div>`;
        } catch (error) {
            processingStatus.innerHTML = `<div class="alert alert-danger">Error processing URL: ${error.message}</div>`;
        }
    });
}