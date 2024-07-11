document.addEventListener('DOMContentLoaded', () => {
    const feedbackButtons = document.querySelectorAll('.feedback-button');
    const feedbackResponse = document.getElementById('feedback-response');
    const closeFeedbackButton = document.getElementById('close-feedback');
    const feedbackContainer = document.getElementById('feedback-container');

    // Check for feedbackClosed cookie and hide feedback container if it exists
    if (getCookie('feedbackClosed')) {
        feedbackContainer.style.display = 'none';
    }

    // Add click event listeners to feedback buttons
    feedbackButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const value = button.getAttribute('data-value');
            await sendFeedback(value);
        });
    });

    // Add click event listener to close button to hide feedback container and set cookie
    closeFeedbackButton.addEventListener('click', () => {
        feedbackContainer.style.display = 'none';
        setCookie('feedbackClosed', 'true', 30); // Set cookie to expire in 30 days
    });

    /**
     * Sends feedback to the server.
     * @param {string} value - The feedback rating value.
     */
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

    /**
     * Sets a cookie in the browser.
     * @param {string} name - The name of the cookie.
     * @param {string} value - The value of the cookie.
     * @param {number} days - The number of days until the cookie expires.
     */
    function setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = name + "=" + value + ";" + expires + ";path=/";
    }

    /**
     * Retrieves a cookie value by name.
     * @param {string} name - The name of the cookie.
     * @returns {string} - The cookie value.
     */
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
