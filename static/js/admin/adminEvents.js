
import { escapeHTML, showError, unescapeHTML } from './utils.js';

/**
 * Displays the event settings interface and initializes the event data.
 * @function
 * @name showEventSettings
 */
export function showEventSettings() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }

    // Clear existing content
    mainContent.innerHTML = '';

    // Create event settings container
    const eventSettingsContainer = document.createElement('div');
    eventSettingsContainer.id = 'event-settings';
    eventSettingsContainer.className = 'tab-pane fade show active';
    eventSettingsContainer.innerHTML = `
            <h2>Developer Day Event Settings</h2>
            <button class="btn btn-primary mb-3" onclick="showAddEventForm()">Add New Event</button>
            <div id="event-map" style="height: 400px; margin-top: 20px;"></div>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Date & Time</th>
                            <th>Location</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="events-table-body">
                        <!-- Events will be populated here -->
                    </tbody>
                </table>
            </div>
        `;

    mainContent.appendChild(eventSettingsContainer);

    // Update active tab in the sidebar
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const eventSettingsLink = document.querySelector('.nav-link[onclick="showEventSettings()"]');
    if (eventSettingsLink) {
        eventSettingsLink.classList.add('active');
    }

    fetchEvents();
}
/**
 * Fetches events from the server and populates the events table and map.
 * @function
 * @name fetchEvents
 */
export function fetchEvents() {
    fetch('/api/events')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(events => {
            console.log('Received events:', events); // For debugging
            populateEventsTable(events);
            displayEventMap(events);
        })
        .catch(error => {
            console.error('Error:', error);
            const tableBody = document.getElementById('events-table-body');
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="4">Error loading events: ${error.message}</td></tr>`;
            }
        });
}
/**
 * Populates the events table with the provided event data.
 * @function
 * @name populateEventsTable
 * @param {Array} events - An array of event objects to display in the table.
 */
export function populateEventsTable(events) {
    const tableBody = document.getElementById('events-table-body');
    if (tableBody) {
        tableBody.innerHTML = '';
        events.forEach(event => {
            const row = `
                    <tr>
                        <td>${escapeHTML(event.title)}</td>
                        <td>${new Date(event.date_time).toLocaleString()} (${event.time_zone})</td>
                        <td>${escapeHTML(event.city)}, ${escapeHTML(event.state)}</td>
                        <td>
                            <button class="btn btn-sm btn-warning" onclick="editEvent('${event._id}')">Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteEvent('${event._id}')">Delete</button>
                        </td>
                    </tr>
                `;
            tableBody.innerHTML += row;
        });
    } else {
        console.error('Events table body not found');
    }
}
/**
 * Displays the form for adding a new event.
 * @function
 * @name showAddEventForm
 */
export function showAddEventForm() {
    const modal = document.getElementById('question-modal');
    modal.querySelector('.modal-title').textContent = 'Add New Event';
    modal.querySelector('.modal-body').innerHTML = `
            <form id="event-form">
                <div class="mb-3">
                    <label for="event-title" class="form-label">Event Title</label>
                    <input type="text" class="form-control" id="event-title" required>
                </div>
                <div class="mb-3">
                    <label for="event-date-time" class="form-label">Date and Time</label>
                    <input type="datetime-local" class="form-control" id="event-date-time" required>
                </div>
                <div class="mb-3">
                    <label for="event-time-zone" class="form-label">Time Zone</label>
                    <input type="text" class="form-control" id="event-time-zone" required>
                </div>
                <div class="mb-3">
                    <label for="event-address1" class="form-label">Address Line 1</label>
                    <input type="text" class="form-control" id="event-address1" required>
                </div>
                <div class="mb-3">
                    <label for="event-address2" class="form-label">Address Line 2</label>
                    <input type="text" class="form-control" id="event-address2">
                </div>
                <div class="mb-3">
                    <label for="event-city" class="form-label">City</label>
                    <input type="text" class="form-control" id="event-city" required>
                </div>
                <div class="mb-3">
                    <label for="event-state" class="form-label">State</label>
                    <input type="text" class="form-control" id="event-state" required>
                </div>
                <div class="mb-3">
                    <label for="event-postal-code" class="form-label">Postal Code</label>
                    <input type="text" class="form-control" id="event-postal-code" required>
                </div>
                <div class="mb-3">
                    <label for="event-country-code" class="form-label">Country Code</label>
                    <input type="text" class="form-control" id="event-country-code" required>
                </div>
                <div class="mb-3">
                    <label for="event-registration-url" class="form-label">Registration URL</label>
                    <input type="url" class="form-control" id="event-registration-url" required>
                </div>
                <div class="mb-3">
                    <label for="event-feedback-url" class="form-label">Feedback URL</label>
                    <input type="url" class="form-control" id="event-feedback-url">
                </div>        
                <div class="form-group">
                    <label for="lead-instructor">Lead Instructor</label>
                    <input type="text" class="form-control" id="lead-instructor" name="lead_instructor">
                </div>
    
                <div class="form-group">
                    <label>Sessions</label>
                    <div>
                        <label class="form-check-label">
                            <input type="checkbox" class="form-check-input session-checkbox" name="sessions" value="Data Modeling"> Data Modeling
                            <input type="text" class="form-control session-instructor" placeholder="Instructor" data-session="Data Modeling">
                        </label>
                    </div>
                    <div>
                        <label class="form-check-label">
                            <input type="checkbox" class="form-check-input session-checkbox" name="sessions" value="Intro Lab"> Intro Lab
                            <input type="text" class="form-control session-instructor" placeholder="Instructor" data-session="Intro Lab">
                        </label>
                    </div>
                    <div>
                        <label class="form-check-label">
                            <input type="checkbox" class="form-check-input session-checkbox" name="sessions" value="Aggregations"> Aggregations
                            <input type="text" class="form-control session-instructor" placeholder="Instructor" data-session="Aggregations">
                        </label>
                    </div>
                    <div>
                        <label class="form-check-label">
                            <input type="checkbox" class="form-check-input session-checkbox" name="sessions" value="Atlas Search"> Atlas Search
                            <input type="text" class="form-control session-instructor" placeholder="Instructor" data-session="Atlas Search">
                        </label>
                    </div>
                    <div>
                        <label class="form-check-label">
                            <input type="checkbox" class="form-check-input session-checkbox" name="sessions" value="VectorSearch"> VectorSearch
                            <input type="text" class="form-control session-instructor" placeholder="Instructor" data-session="VectorSearch">
                        </label>
                    </div>
                </div>
            </form>
        `;
    modal.querySelector('.modal-footer').innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" onclick="saveEvent()">Save Event</button>
        `;
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
}
/**
 * Saves a new event to the server.
 * @function
 * @name saveEvent
 */
export function saveEvent() {
    const eventData = {
        title: document.getElementById('event-title').value,
        date_time: document.getElementById('event-date-time').value,
        time_zone: document.getElementById('event-time-zone').value,
        address1: document.getElementById('event-address1').value,
        address2: document.getElementById('event-address2').value,
        city: document.getElementById('event-city').value,
        state: document.getElementById('event-state').value,
        postal_code: document.getElementById('event-postal-code').value,
        country_code: document.getElementById('event-country-code').value,
        registration_url: document.getElementById('event-registration-url').value,
        feedback_url: document.getElementById('event-feedback-url').value
    };

    fetch('/api/events', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
    })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            bootstrap.Modal.getInstance(document.getElementById('question-modal')).hide();
            fetchEvents();
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}
/**
 * Updates an existing event on the server.
 * @function
 * @name updateEvent
 * @param {string} eventId - The ID of the event to update.
 */
export function updateEvent(eventId) {
    const eventData = {
        title: document.getElementById('event-title').value,
        date_time: document.getElementById('event-date-time').value,
        time_zone: document.getElementById('event-time-zone').value,
        address1: document.getElementById('event-address1').value,
        address2: document.getElementById('event-address2').value,
        city: document.getElementById('event-city').value,
        state: document.getElementById('event-state').value,
        postal_code: document.getElementById('event-postal-code').value,
        country_code: document.getElementById('event-country-code').value,
        registration_url: document.getElementById('event-registration-url').value,
        feedback_url: document.getElementById('event-feedback-url').value
    };

    fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
    })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            bootstrap.Modal.getInstance(document.getElementById('question-modal')).hide();
            fetchEvents();
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}
/**
 * Populates the edit form with existing event data for editing.
 * @function
 * @name editEvent
 * @param {string} eventId - The ID of the event to edit.
 */
export function editEvent(eventId) {
    // Fetch event details and show edit form
    fetch(`/api/events/${eventId}`)
        .then(response => response.json())
        .then(event => {
            showAddEventForm(); // Reuse the add form
            document.getElementById('event-title').value = event.title || '';
            document.getElementById('event-date-time').value = event.date_time ? new Date(event.date_time).toISOString().slice(0, 16) : '';
            document.getElementById('event-time-zone').value = event.time_zone || '';
            document.getElementById('event-address1').value = event.address1 || '';
            document.getElementById('event-address2').value = event.address2 || '';
            document.getElementById('event-city').value = event.city || '';
            document.getElementById('event-state').value = event.state || '';
            document.getElementById('event-postal-code').value = event.postal_code || '';
            document.getElementById('event-country-code').value = event.country_code || '';
            document.getElementById('event-registration-url').value = event.registration_url || '';
            document.getElementById('event-feedback-url').value = event.feedback_url || '';

            // Change the save button to update
            const saveButton = document.querySelector('.modal-footer .btn-primary');
            saveButton.textContent = 'Update Event';
            saveButton.onclick = () => updateEvent(eventId);
        })
        .catch(error => {
            console.error('Error fetching event details:', error);
            alert('Failed to fetch event details. Please try again.');
        });
}
/**
 * Deletes an event from the server.
 * @function
 * @name deleteEvent
 * @param {string} eventId - The ID of the event to delete.
 */
export function deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this event?')) {
        fetch(`/api/events/${eventId}`, {
            method: 'DELETE',
        })
            .then(response => response.json())
            .then(data => {
                console.log('Success:', data);
                fetchEvents();
            })
            .catch((error) => {
                console.error('Error:', error);
            });
    }
}
/**
 * Displays events on a Google Map.
 * @function
 * @name displayEventMap
 * @param {Array} events - An array of event objects to display on the map.
 */
export function displayEventMap(events) {
    const mapContainer = document.getElementById('event-map');
    if (!mapContainer) {
        console.log("Map container not found");
        return;
    }

    // Check if the Google Maps API is fully loaded
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.log("Google Maps API is not loaded yet");
        return;
    }

    // Initialize the map
    const map = new google.maps.Map(mapContainer, {
        zoom: 2,
        center: { lat: 0, lng: 0 }
    });

    const bounds = new google.maps.LatLngBounds();
    let hasValidCoordinates = false;

    // Function to create a marker (works with both AdvancedMarkerElement and standard Marker)
    function createMarker(position, title) {
        if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
            return new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: position,
                title: title
            });
        } else {
            console.warn('AdvancedMarkerElement not available, falling back to Marker');

            return new google.maps.Marker({
                map: map,
                position: position,
                title: title
            });
        }
    }

    // Add markers for each event
    events.forEach(event => {
        if (event.location && event.location.coordinates) {
            const [lng, lat] = event.location.coordinates;
            const position = new google.maps.LatLng(lat, lng);

            const marker = createMarker(position, event.title);

            // Format the date
            let formattedDate = "Date not available";
            if (event.date_time) {
                const eventDate = new Date(event.date_time);
                if (!isNaN(eventDate.getTime())) {
                    formattedDate = eventDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                } else {
                    // If the date is invalid, use the original string
                    formattedDate = event.date_time;
                }
            }

            // Create the content for the InfoWindow
            const infoWindowContent = `
                    <div style="max-width: 300px;">
                        <h3 style="margin-bottom: 5px;">${event.title}</h3>
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
                        <p style="margin: 5px 0;"><strong>Location:</strong><br>
                            ${event.address1}${event.address2 ? '<br>' + event.address2 : ''}<br>
                            ${event.city}, ${event.state} ${event.postal_code}<br>
                            ${event.country_code}
                        </p>
                        ${event.registration_url ? `<p style="margin: 10px 0;"><a href="${event.registration_url}" target="_blank" style="background-color: #4CAF50; color: white; padding: 5px 10px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">Register</a></p>` : ''}
                        ${event.feedback_url ? `<p style="margin: 5px 0;"><a href="${event.feedback_url}" target="_blank" style="background-color: #007bff; color: white; padding: 5px 10px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">Provide Feedback</a></p>` : ''}
                    </div>
                `;

            const infoWindow = new google.maps.InfoWindow({
                content: infoWindowContent
            });

            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });

            bounds.extend(position);
            hasValidCoordinates = true;
        }
    });

    if (hasValidCoordinates) {
        map.fitBounds(bounds);
    } else {
        console.log("No events with valid coordinates found");
    }
}

window.initMap = function() {
    // Your map initialization code here
    const map = new google.maps.Map(document.getElementById("event-map"), {
        center: { lat: 0, lng: 0 },
        zoom: 2,
    });
    // Any other map setup code...
};