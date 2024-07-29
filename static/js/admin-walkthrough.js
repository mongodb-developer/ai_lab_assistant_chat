let tour;

function startTour() {
  tour.start();
}


document.addEventListener('DOMContentLoaded', function() {
    const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
            classes: 'shadow-md bg-purple-dark',
            scrollTo: true
        }
    });

    tour.addStep({
        id: 'dashboard',
        text: 'Welcome to the AI System Admin Dashboard. Here you can monitor system performance, manage users, and configure settings.',
        attachTo: {
            element: '#dashboard',
            on: 'bottom'
        },
        buttons: [
            {
                text: 'Next',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'user-management',
        text: 'In this section, you can add, remove, or modify user accounts and permissions.',
        attachTo: {
            element: '#user-management',
            on: 'bottom'
        },
        buttons: [
            {
                text: 'Back',
                action: tour.back
            },
            {
                text: 'Next',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'document-management',
        text: 'Here you can view and manage all documents in the system, including uploading new documents and deleting old ones.',
        attachTo: {
            element: '#document-management',
            on: 'bottom'
        },
        buttons: [
            {
                text: 'Back',
                action: tour.back
            },
            {
                text: 'Next',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'index-management',
        text: 'This section allows you to create and manage vector indexes for efficient similarity searches.',
        attachTo: {
            element: '#index-management',
            on: 'top'
        },
        buttons: [
            {
                text: 'Back',
                action: tour.back
            },
            {
                text: 'Next',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'performance-metrics',
        text: 'Monitor system performance, including query response times and resource usage.',
        attachTo: {
            element: '#performance-metrics',
            on: 'top'
        },
        buttons: [
            {
                text: 'Back',
                action: tour.back
            },
            {
                text: 'Next',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'system-configuration',
        text: 'Configure system-wide settings such as API keys, embedding model selection, and database connections.',
        attachTo: {
            element: '#system-configuration',
            on: 'top'
        },
        buttons: [
            {
                text: 'Back',
                action: tour.back
            },
            {
                text: 'Next',
                action: tour.next
            }
        ]
    });

    tour.addStep({
        id: 'backup-restore',
        text: 'Set up automated backups and restore data if needed.',
        attachTo: {
            element: '#backup-restore',
            on: 'left'
        },
        buttons: [
            {
                text: 'Back',
                action: tour.back
            },
            {
                text: 'Finish',
                action: tour.complete
            }
        ]
    });

});