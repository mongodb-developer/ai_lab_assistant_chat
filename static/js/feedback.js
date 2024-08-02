document.addEventListener('DOMContentLoaded', function () {
    const feedbackButtons = document.querySelectorAll('.feedback-button');
    if (feedbackButtons) {
        feedbackButtons.forEach(button => {
            button.addEventListener('click', async function () {
                const value = this.getAttribute('data-value');
                await provideFeedback(value);
            });
        });
    }
});

async function provideFeedback(value) {
    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        if (!response.ok) throw new Error('Network response was not ok');
        alert('Feedback submitted. Thank you!');
    } catch (error) {
        console.error('Error submitting feedback:', error);
        alert('Failed to submit feedback. Please try again.');
    }
}
