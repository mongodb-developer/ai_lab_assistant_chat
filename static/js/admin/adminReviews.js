
export function showDesignReviews() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }
    mainContent.innerHTML = '';
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

    mainContent.appendChild(designReviewsContainer);
    fetch('/api/design_reviews')
        .then(response => response.json())
        .then(data => {
            const designReviewsTableBody = document.getElementById('design-reviews-table-body');
            if (!designReviewsTableBody) {
                console.error('Design reviews table body element not found');
                return;
            }
            designReviewsTableBody.innerHTML = '';
            data.forEach(review => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${review.full_name}</td>
                    <td>${review.company_name}</td>
                    <td>${review.application_status}</td>
                    <td>${review.skill_level}</td>
                    <td>${createScoreIndicator(review.total_score)}</td>

                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editReview('${review._id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteReview('${review._id}')">Delete</button>
                        <button class="btn btn-sm btn-secondary" onclick="reviewDesign('${review._id}')">Review</button>
                    </td>
                `;
                designReviewsTableBody.appendChild(row);
            });
        })
        .catch(error => console.error('Error fetching design reviews:', error));
}

export function editReview(id) {
    console.log("Edit Review export function called with id:", id);

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

export function reviewDesign(id) {
    const reviewModal = new bootstrap.Modal(document.getElementById('reviewModal'));
    const reviewForm = document.getElementById('review-form');
    reviewForm.reset();
    reviewForm.dataset.reviewId = id; // Store the review ID in the form

    reviewModal.show();

    reviewForm.onsubmit = function (event) {
        event.preventDefault();
        const formData = new FormData(reviewForm);
        formData.append('id', id);

        fetch(`/api/design_reviews/${id}/upload_transcript`, {
            method: 'POST',
            body: formData,
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Failed to submit review.');
                } else {
                    alert('Review submitted successfully!');
                    reviewModal.hide();
                    showDesignReviews();
                }
            })
            .catch(error => console.error('Error submitting review:', error));
    };
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
            `;

            // Create a temporary element to hold the report content and select it for copying
            const tempElement = document.createElement('textarea');
            tempElement.value = reportContent;
            document.body.appendChild(tempElement);
            tempElement.select();
            document.execCommand('copy');
            document.body.removeChild(tempElement);

            alert('Report copied to clipboard!');
        })
        .catch(error => console.error('Error generating report:', error));
}

export function showEditReviewModal(review) {
    const modal = document.getElementById('design-review-modal');
    if (!modal) {
        console.error('Design review modal not found');
        return;
    }

    console.log('Modal content:', modal.innerHTML);

    modal.querySelector('.modal-title').textContent = 'Edit Design Review';
    modal.querySelector('.modal-body').innerHTML = `
        <form id="edit-review-form">
            <input type="hidden" id="review-id" value="${review._id}">
            <div class="mb-3">
                <label for="full-name" class="form-label">Full Name</label>
                <input type="text" class="form-control" id="full-name" value="${review.full_name}" required>
            </div>
            <div class="mb-3">
                <label for="company-name" class="form-label">Company Name</label>
                <input type="text" class="form-control" id="company-name" value="${review.company_name}" required>
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
                    <option value="Pending" ${review.review_status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${review.review_status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${review.review_status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Rejected" ${review.review_status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="skill-level" class="form-label">Skill Level</label>
                <select class="form-select" id="skill-level" required>
                    <option value="Beginner" ${review.skill_level === 'Beginner' ? 'selected' : ''}>Beginner</option>
                    <option value="Intermediate" ${review.skill_level === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
                    <option value="Advanced" ${review.skill_level === 'Advanced' ? 'selected' : ''}>Advanced</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="total-score" class="form-label">Total Score</label>
                <input type="number" class="form-control" id="total-score" value="${review.total_score || 0}" min="0" max="100" required readonly>
            </div>
            <div class="mb-3">
                <label for="review-details" class="form-label">Review Details</label>
                <textarea class="form-control" id="review-details" rows="5" required>${review.review_details || ''}</textarea>
            </div>
        </form>
    `;
    modal.querySelector('.modal-footer').innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary" id="updateReviewButton">Save Changes</button>
    `;

    const updateButton = modal.querySelector('#updateReviewButton');
    if (!updateButton) {
        console.error('Update button not found in the modal');
        console.log('Modal footer content:', modal.querySelector('.modal-footer').innerHTML);
        return;
    }
    updateButton.onclick = updateReview(review._id);

    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
}