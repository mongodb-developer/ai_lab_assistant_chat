document.addEventListener('DOMContentLoaded', () => {
    const feedbackButtons = document.querySelectorAll('.feedback-button');
    const feedbackResponse = document.getElementById('feedback-response');
    const closeFeedbackButton = document.getElementById('close-feedback');
    const feedbackContainer = document.getElementById('feedback-container');

    // Check for feedbackClosed cookie
    if (getCookie('feedbackClosed')) {
        feedbackContainer.style.display = 'none';
    }

    feedbackButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const value = button.getAttribute('data-value');
            await sendFeedback(value);
        });
    });

    closeFeedbackButton.addEventListener('click', () => {
        feedbackContainer.style.display = 'none';
        setCookie('feedbackClosed', 'true', 30); // Set cookie to expire in 30 days
    });

    async function sendFeedback(value) {
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rating: value }),
            });

            if (response.ok) {
                feedbackResponse.innerText = 'Thank you for your feedback!';
            } else {
                throw new Error('Feedback submission failed');
            }
        } catch (error) {
            feedbackResponse.innerText = 'There was an error submitting your feedback. Please try again.';
            console.error('Error:', error);
        }
    }

    function setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = name + "=" + value + ";" + expires + ";path=/";
    }

    function getCookie(name) {
        const cname = name + "=";
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(cname) === 0) {
                return c.substring(cname.length, c.length);
            }
        }
        return "";
    }
});
