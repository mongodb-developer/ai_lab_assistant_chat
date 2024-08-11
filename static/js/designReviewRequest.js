document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('designReviewForm');
    const steps = document.querySelectorAll('.step');
    const nextButtons = document.querySelectorAll('.next-step');
    const prevButtons = document.querySelectorAll('.prev-step');

    let currentStep = 0;

    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                steps[currentStep].style.display = 'none';
                currentStep++;
                steps[currentStep].style.display = 'block';
            }
        });
    });

    prevButtons.forEach(button => {
        button.addEventListener('click', () => {
            steps[currentStep].style.display = 'none';
            currentStep--;
            steps[currentStep].style.display = 'block';
        });
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (validateStep(currentStep)) {
            const formData = new FormData(form);
            const requestData = Object.fromEntries(formData);

            try {
                const response = await fetch('/api/design_reviews', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData),
                });

                if (response.ok) {
                    alert('Design review request submitted successfully!');
                    form.reset();
                    window.location.href = '/'; // Redirect to home page or thank you page
                } else {
                    throw new Error('Failed to submit design review request');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred while submitting the request. Please try again.');
            }
        }
    });

    function validateStep(step) {
        const currentStepElement = steps[step];
        const requiredFields = currentStepElement.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('is-invalid');
            } else {
                field.classList.remove('is-invalid');
            }
        });

        return isValid;
    }
});