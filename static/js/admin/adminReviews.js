
export function showDesignReviews() {
    console.log('In showDesignReviews...');

    const mainContent = document.getElementById('main-content');
    console.log('mainContent:', mainContent);

    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }

    console.log('Creating design reviews container...');
    // Create design reviews container
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
    mainContent.innerHTML = ''; // Clear existing content
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
                    <td>${review.full_name}</td>
                    <td>${review.company_name}</td>
                    <td>${review.application_status}</td>
                    <td>${review.skill_level}</td>
                    <td>${createScoreIndicator(review.total_score)}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-review" data-id="${review._id}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-review" data-id="${review._id}">Delete</button>
                        <button class="btn btn-sm btn-secondary review-design" data-id="${review._id}">Review</button>
                    </td>
                `;
                designReviewsTableBody.appendChild(row);
            });
            designReviewsTableBody.addEventListener('click', (event) => {
                const target = event.target;
                if (target.classList.contains('edit-review')) {
                    editReview(target.dataset.id);
                } else if (target.classList.contains('delete-review')) {
                    deleteReview(target.dataset.id);
                } else if (target.classList.contains('review-design')) {
                    reviewDesign(target.dataset.id);
                }
            });
            console.log('Design reviews table populated');
        })
        .catch(error => console.error('Error fetching design reviews:', error));
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

export function updateReview(reviewId) {
    console.log('Update Review export function called with id:', reviewId);
    return function() {
        console.log('Review ID:', reviewId);

        if (!reviewId) {
            console.error('No review ID found');
            alert('Error: No review ID found. Please try again.');
            return;
        }

        const updatedReview = {
            full_name: document.getElementById('full-name').value,
            company_name: document.getElementById('company-name').value,
            application_status: document.getElementById('application-status').value,
            review_status: document.getElementById('review-status').value,
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
            showDesignReviews();  // Refresh the design reviews list
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Failed to update review. Please check the console for more details.');
        });
    };
}


export function deleteReview(id) {
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
        what_we_advise: document.getElementById('what-we-advise').value
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
        showDesignReviews();  // Refresh the design reviews list
    })
    .catch(error => {
        console.error('Error saving review:', error);
        alert('Error saving review. Please check the console and try again.');
    });
}

// In the showEditReviewModal function:
const transcriptionUpload = document.getElementById('transcription-upload');
const reviewDetailsTextarea = document.getElementById('review-details');

if (transcriptionUpload && reviewDetailsTextarea) {
    transcriptionUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        const reviewDetails = reviewDetailsTextarea.value;
        if (file) {
            console.log("File selected:", file.name);
            uploadAndProcessTranscription(review._id, file, reviewDetails);
        }
    });
} else {
    console.error('Transcription upload input or review details textarea not found');
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
// Any oth/ Helper export function to create a visual score indicator
export function createScoreIndicator(score) {
    // Assuming score is out of 100
    const percentage = Math.min(Math.max(score, 0), 100); // Ensure score is between 0 and 100
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

export function generateReport(reviewId) {
    fetch(`/api/design_reviews/${reviewId}`)
        .then(response => response.json())
        .then(review => {
            if (!review) {
                alert('Review not found');
                return;
            }

            const reportContent = `
# Design Review Report

## Full Name
${review.full_name}

## Company Name
${review.company_name}

## Application Status
${review.application_status}

## Skill Level
${review.skill_level}

## What We Heard
${review.what_we_heard}

## Key Issues
${review.key_issues}

## What We Advise
${review.what_we_advise}

## Total Score
${review.total_score}

## Review Details
${review.review_details}
    `;

            // Create a Blob with the report content
            const blob = new Blob([reportContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            // Create a temporary link and trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = `Design_Review_Report_${reviewId}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        })
        .catch(error => console.error('Error generating report:', error));
}

export function showEditReviewModal(review) {
    const modal = document.getElementById('design-review-modal');
    if (!modal) {
        console.error('Design review modal not found');
        return;
    }

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    if (!modalTitle || !modalBody || !modalFooter) {
        console.error('Modal structure is incomplete');
        return;
    }

    modalTitle.textContent = 'Edit Design Review';
    
    modalBody.innerHTML = `
        <div class="mb-3">
            <label for="full-name" class="form-label">Full Name</label>
            <input type="text" class="form-control" id="full-name" value="${review.full_name || ''}">
        </div>
        <div class="mb-3">
            <label for="company-name" class="form-label">Company Name</label>
            <input type="text" class="form-control" id="company-name" value="${review.company_name || ''}">
        </div>
        <div class="mb-3">
            <label for="application-status" class="form-label">Application Status</label>
            <input type="text" class="form-control" id="application-status" value="${review.application_status || ''}">
        </div>
        <div class="mb-3">
            <label for="skill-level" class="form-label">Skill Level</label>
            <input type="text" class="form-control" id="skill-level" value="${review.skill_level || ''}">
        </div>
        <div class="mb-3">
            <label for="total-score" class="form-label">Total Score</label>
            <input type="number" class="form-control" id="total-score" value="${review.total_score || 0}">
        </div>
        <div class="mb-3">
            <label for="transcription-upload" class="form-label">Upload Transcription</label>
            <input type="file" class="form-control" id="transcription-upload" accept=".txt,.doc,.docx,.pdf">
        </div>
        <div class="mb-3">
            <label for="what-we-heard" class="form-label">What We Heard</label>
            <textarea class="form-control" id="what-we-heard" rows="3">${review.what_we_heard || ''}</textarea>
        </div>
        <div class="mb-3">
            <label for="key-issues" class="form-label">Key Issues</label>
            <textarea class="form-control" id="key-issues" rows="3">${review.key_issues || ''}</textarea>
        </div>
        <div class="mb-3">
            <label for="what-we-advise" class="form-label">What We Advise</label>
            <textarea class="form-control" id="what-we-advise" rows="3">${review.what_we_advise || ''}</textarea>
        </div>
    `;

    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary" id="updateReviewButton">Save Changes</button>
    `;

    const transcriptionUpload = document.getElementById('transcription-upload');
    if (transcriptionUpload) {
        transcriptionUpload.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                console.log("File selected:", file.name); // Add this line for debugging
                uploadAndProcessTranscription(review._id, file);
            }
        });
    } else {
        console.error('Transcription upload input not found');
    }

    const updateButton = modal.querySelector('#updateReviewButton');
    if (updateButton) {
        updateButton.onclick = updateReview(review._id);
    } else {
        console.error('Update button not found in the modal');
    }

    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
}

document.addEventListener('DOMContentLoaded', () => {
    const designReviewModal = document.getElementById('design-review-modal');
    if (designReviewModal) {
        new bootstrap.Modal(designReviewModal);
    }
});