document.addEventListener('DOMContentLoaded', function () {
    const userInput = document.getElementById('user-input');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');

    if (userInput) {
        userInput.addEventListener('input', debounce(getSuggestions, 300));
        userInput.addEventListener('keydown', handleKeyDown);
    }

    async function getSuggestions() {
        if (!userInput.value) {
            clearAutocomplete();
            return;
        }

        try {
            const response = await fetch(`/api/autocomplete?prefix=${encodeURIComponent(userInput.value)}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const suggestions = await response.json();

            renderAutocomplete(suggestions);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    function renderAutocomplete(suggestions) {
        clearAutocomplete();
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.classList.add('autocomplete-item');
            item.textContent = suggestion;
            item.addEventListener('click', function() {
                userInput.value = suggestion;
                clearAutocomplete();
                userInput.focus();
            });
            autocompleteDropdown.appendChild(item);
        });
        autocompleteDropdown.style.display = 'block';
    }

    function clearAutocomplete() {
        autocompleteDropdown.innerHTML = '';
        autocompleteDropdown.style.display = 'none';
    }

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
    function handleKeyDown(e) {
        const dropdown = document.getElementById('autocomplete-dropdown');
        const items = dropdown.getElementsByTagName('div');
    
        if (e.keyCode === 40) { // down arrow
            currentFocus++;
            addActive(items);
        } else if (e.keyCode === 38) { // up arrow
            currentFocus--;
            addActive(items);
        } else if (e.keyCode === 13) { // enter
            e.preventDefault();
            if (currentFocus > -1) {
                if (items) items[currentFocus].click();
            }
        }
    }
});
