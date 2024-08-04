/**
 * Displays an error message to the user.
 * @param {string} message - The error message to display.
 * @param {string} [elementId] - The ID of the element where the error should be displayed. If not provided, a default location is used.
 */
export function showError(message, elementId = 'error-container') {
    // Log the error to the console for debugging
    console.error(message);

    // Find the container where the error message will be displayed
    const errorContainer = document.getElementById(elementId);

    if (errorContainer) {
        // Create a new error message element
        const errorElement = document.createElement('div');
        errorElement.className = 'alert alert-danger alert-dismissible fade show';
        errorElement.role = 'alert';
        errorElement.innerHTML = `
            <strong>Error:</strong> ${escapeHTML(message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        // Add the error message to the container
        errorContainer.appendChild(errorElement);

        // Optionally, scroll to the error message
        errorContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Automatically remove the error message after a certain time (e.g., 5 seconds)
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    } else {
        // If the specified container doesn't exist, fall back to an alert
        alert(`Error: ${message}`);
    }
}

// Escape HTML special characters in a string
export function escapeHTML(str) {
    if (typeof str !== 'string') {
        console.warn('escapeHTML received a non-string value:', str);
        return '';
    }
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

export function unescapeHTML(str) {
    if (typeof str !== 'string') {
        console.warn('unescapeHTML received a non-string value:', str);
        return '';
    }
    return str.replace(/&amp;|&lt;|&gt;|&#39;|&quot;/g, tag => ({
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&#39;': "'",
        '&quot;': '"'
    }[tag] || tag));
}

function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
}