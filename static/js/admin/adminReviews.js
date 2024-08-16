
export function showDesignReviews() {
    console.log('In showDesignReviews...');
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }

    console.log('Creating design reviews container...');
    const designReviewsContainer = document.createElement('div');
    designReviewsContainer.id = 'design-reviews';
    designReviewsContainer.innerHTML = `
        <h2>Design Review Requests</h2>
        <div class="table-responsive mt-3">
            <table class="table table-striped table-sm">
                <thead>
                    <tr>
                        <th>Full Name</th>
                        <th>Company Name</th>
                        <th>Application Status</th>
                        <th>Skill Level</th>
                        <th>Score</th>
                        <th>Review Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="design-reviews-table-body">
                    <!-- Design reviews will be populated here -->
                </tbody>
            </table>
        </div>
    `;

    console.log('Appending design reviews container to main content...');
    mainContent.innerHTML = '';
    mainContent.appendChild(designReviewsContainer);

    console.log('Fetching design reviews...');
    fetch('/api/design_reviews')
        .then(response => response.json())
        .then(data => {
            console.log('Received design reviews data:', data);
            const designReviewsTableBody = document.getElementById('design-reviews-table-body');
            if (!designReviewsTableBody) {
                console.error('Design reviews table body element not found');
                return;
            }
            designReviewsTableBody.innerHTML = '';
            data.forEach(review => {
                console.log('Processing review:', review);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${review.full_name || 'N/A'}</td>
                    <td>${review.company_name || 'N/A'}</td>
                    <td>${review.application_status || 'N/A'}</td>
                    <td>${review.skill_level || 'N/A'}</td>
                    <td>${createScoreIndicator(review.total_score || 0)}</td>
                    <td>${review.status || 'N/A'}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-review" data-id="${review._id}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-review" data-id="${review._id}">Delete</button>
                        <button class="btn btn-sm btn-secondary review-design" data-id="${review._id}">Review</button>
                        <button class="btn btn-sm btn-info generate-report" data-id="${review._id}">Generate Report</button>
                    </td>
                `;
                designReviewsTableBody.appendChild(row);
            });
            designReviewsTableBody.addEventListener('click', handleTableActions);
            console.log('Design reviews table populated');
        })
        .catch(error => console.error('Error fetching design reviews:', error));
}

function handleTableActions(event) {
    const target = event.target;
    if (target.classList.contains('edit-review')) {
        editReview(target.dataset.id);
    } else if (target.classList.contains('delete-review')) {
        deleteReview(target.dataset.id);
    } else if (target.classList.contains('review-design')) {
        reviewDesign(target.dataset.id);
    } else if (target.classList.contains('generate-report')) {
        generateReport(target.dataset.id);
    }
}

export function editReview(id) {
    console.log("Edit Review function called with id:", id);
    if (!id) {
        console.error('No review ID provided');
        return;
    }

    fetch(`/api/design_reviews/${id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(review => {
            if (!review) {
                throw new Error('No review data received');
            }
            showEditReviewModal(review);
        })
        .catch(error => {
            console.error('Error fetching review details:', error);
            alert('Failed to fetch review details. Please try again.');
        });
}

function updateReview(reviewId) {
    return function() {
        console.log('Update Review function called with id:', reviewId);
        if (!reviewId) {
            console.error('No review ID found');
            alert('Error: No review ID found. Please try again.');
            return;
        }

        const updatedReview = {
            full_name: document.getElementById('full-name').value,
            company_name: document.getElementById('company-name').value,
            application_status: document.getElementById('application-status').value,
            status: document.getElementById('review-status').value,
            skill_level: document.getElementById('skill-level').value,
            total_score: document.getElementById('total-score').value,
            review_details: document.getElementById('review-details').value
        };

        console.log('Sending update for review:', reviewId);
        console.log('Update data:', updatedReview);

        fetch(`/api/design_reviews/${reviewId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedReview),
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            bootstrap.Modal.getInstance(document.getElementById('design-review-modal')).hide();
            showDesignReviews();
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Failed to update review. Please check the console for more details.');
        });
    };
}

function deleteReview(id) {
    if (confirm('Are you sure you want to delete this design review request?')) {
        fetch(`/api/design_reviews/${id}`, { method: 'DELETE' })
            .then(response => {
                if (response.ok) {
                    showDesignReviews();
                } else {
                    alert('Failed to delete design review request.');
                }
            })
            .catch(error => console.error('Error deleting design review request:', error));
    }
}

function uploadAndProcessTranscription(reviewId) {
    const fileInput = document.getElementById('transcription-upload');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file to upload.');
        return;
    }

    const formData = new FormData();
    formData.append('transcript', file);

    fetch(`/api/design_reviews/${reviewId}/upload_transcript`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Transcription uploaded and processed:', data);
        document.getElementById('what-we-heard').value = data.what_we_heard || '';
        document.getElementById('key-issues').value = data.key_issues || '';
        document.getElementById('what-we-advise').value = data.what_we_advise || '';
        document.getElementById('references').value = data.references || '';
    })
    .catch(error => {
        console.error('Error uploading and processing transcription:', error);
        alert('Error uploading and processing transcription. Please try again.');
    });
}

function saveReview(reviewId) {
    const reviewData = {
        what_we_heard: document.getElementById('what-we-heard').value,
        key_issues: document.getElementById('key-issues').value,
        what_we_advise: document.getElementById('what-we-advise').value,
        references: document.getElementById('references').value
    };

    console.log('Saving review data:', reviewData);

    fetch(`/api/design_reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewData)
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Review saved:', data);
        alert('Review saved successfully!');
        bootstrap.Modal.getInstance(document.getElementById('reviewModal')).hide();
        showDesignReviews();
    })
    .catch(error => {
        console.error('Error saving review:', error);
        alert('Error saving review. Please check the console and try again.');
    });
}

function reviewDesign(id) {
    const reviewModal = new bootstrap.Modal(document.getElementById('reviewModal'));
    const reviewForm = document.getElementById('review-form');
    reviewForm.reset();
    reviewForm.dataset.reviewId = id;

    const uploadButton = document.getElementById('upload-transcript-btn');
    const saveButton = document.getElementById('save-review-btn');

    uploadButton.onclick = () => uploadAndProcessTranscription(id);
    saveButton.onclick = () => saveReview(id);

    reviewModal.show();
}
function createScoreIndicator(score) {
    const percentage = Math.min(Math.max(score, 0), 100);
    const color = percentage > 80 ? 'bg-success' :
        percentage > 60 ? 'bg-info' :
            percentage > 40 ? 'bg-warning' : 'bg-danger';

    return `
        <div class="progress" style="height: 20px;" title="Score: ${score}">
            <div class="progress-bar ${color}" role="progressbar" 
                 style="width: ${percentage}%;" 
                 aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100">
                ${score}
            </div>
        </div>
    `;
}

function showEditReviewModal(review) {
    const modal = document.getElementById('design-review-modal');
    if (!modal) {
        console.error('Design review modal not found');
        return;
    }

    console.log('Review data:', review);

    modal.querySelector('.modal-title').textContent = 'Edit Design Review';
    modal.querySelector('.modal-body').innerHTML = `
        <form id="edit-review-form">
            <input type="hidden" id="review-id" value="${review._id}">
            <div class="mb-3">
                <label for="full-name" class="form-label">Full Name</label>
                <input type="text" class="form-control" id="full-name" value="${review.full_name || ''}" required>
            </div>
            <div class="mb-3">
                <label for="company-name" class="form-label">Company Name</label>
                <input type="text" class="form-control" id="company-name" value="${review.company_name || ''}" required>
            </div>
            <div class="mb-3">
                <label for="application-status" class="form-label">Application Status</label>
                <select class="form-select" id="application-status" required>
                    <option value="Not started" ${review.application_status === 'Not started' ? 'selected' : ''}>Not started</option>
                    <option value="In design phase" ${review.application_status === 'In design phase' ? 'selected' : ''}>In design phase</option>
                    <option value="In production" ${review.application_status === 'In production' ? 'selected' : ''}>In production</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="review-status" class="form-label">Design Review Request Status</label>
                <select class="form-select" id="review-status" required>
                    <option value="SUBMITTED" ${review.status === 'SUBMITTED' ? 'selected' : ''}>Submitted</option>
                    <option value="IN_PROGRESS" ${review.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                    <option value="COMPLETED" ${review.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                    <option value="REJECTED" ${review.status === 'REJECTED' ? 'selected' : ''}>Rejected</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="skill-level" class="form-label">Skill Level</label>
                <select class="form-select" id="skill-level" required>
                    <option value="Beginner" ${review.skill_level === 'Beginner' ? 'selected' : ''}>Beginner</option>
                    <option value="Intermediate" ${review.skill_level === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
                    <option value="Expert" ${review.skill_level === 'Expert' ? 'selected' : ''}>Expert</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="total-score" class="form-label">Total Score</label>
                <input type="number" class="form-control" id="total-score" value="${review.total_score || 0}" min="0" max="100" required>
            </div>
            <div class="mb-3">
                <label for="review-details" class="form-label">Review Details</label>
                <textarea class="form-control" id="review-details" rows="5">${review.review_details || ''}</textarea>
            </div>
        </form>
    `;

    modal.querySelector('.modal-footer').innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary" id="updateReviewButton">Save Changes</button>
    `;

    const updateButton = modal.querySelector('#updateReviewButton');
    if (updateButton) {
        updateButton.onclick = updateReview(review._id);
    } else {
        console.error('Update button not found in the modal');
    }

    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
}

// Initialize the functionality when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const designReviewModal = document.getElementById('design-review-modal');
    if (designReviewModal) {
        new bootstrap.Modal(designReviewModal);
    }
    showDesignReviews();
});

function generateReport(reviewId) {
    fetch(`/api/design_reviews/${reviewId}`)
        .then(response => response.json())
        .then(review => {
            if (!review) {
                alert('Review not found');
                return;
            }

            const reportContent = `
# Design Review Report

## Project Overview
- **Full Name:** ${review.full_name}
- **Company Name:** ${review.company_name}
- **Application Status:** ${review.application_status}
- **Skill Level:** ${review.skill_level}
- **Total Score:** ${review.total_score}
- **Opportunity Level:** ${review.opportunity_level}

## What We Heard
${review.what_we_heard || 'N/A'}

## Key Issues
${review.key_issues || 'N/A'}

## What We Advise
${review.what_we_advise || 'N/A'}

## References
${review.references || 'N/A'}
            `;

            showReportModal(reportContent);
        })
        .catch(error => console.error('Error generating report:', error));
}

function showReportModal(reportContent) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'reportModal';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Design Review Report</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <pre>${reportContent}</pre>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary" onclick="copyReportToClipboard()">Copy to Clipboard</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    modal.addEventListener('hidden.bs.modal', function () {
        document.body.removeChild(modal);
    });
}

function copyReportToClipboard() {
    const reportContent = document.querySelector('#reportModal .modal-body pre').textContent;
    navigator.clipboard.writeText(reportContent).then(() => {
        alert('Report copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy report: ', err);
        alert('Failed to copy report to clipboard. Please try again.');
    });
}

// Make sure to expose the copyReportToClipboard function globally
window.copyReportToClipboard = copyReportToClipboard;