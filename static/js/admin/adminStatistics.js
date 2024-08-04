import { escapeHTML, showError, unescapeHTML } from './utils.js';

const statisticsTab = document.querySelector('[onclick="showAnswerFeedbackStats()"]');
if (statisticsTab) {
    statisticsTab.removeAttribute('onclick');
    statisticsTab.addEventListener('click', showStatistics);
} else {
    console.error('Statistics tab not found');
}
/**
 * Fetches and displays answer feedback statistics.
 * @async
 * @function showAnswerFeedbackStats
 * @throws {Error} If there's an issue fetching the statistics
 */
async function showAnswerFeedbackStats() {
    try {
        const response = await fetch('/api/answer_feedback_stats');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const stats = await response.json();

        const statsTableBody = document.getElementById('answer-feedback-stats-body');
        if (!statsTableBody) {
            console.error('answer-feedback-stats-body element not found');
            return;
        }

        if (stats.length === 0) {
            statsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No answer feedback statistics available.</td></tr>';
        } else {
            statsTableBody.innerHTML = stats.map(stat => `
                    <tr>
                        <td>${escapeHTML(stat.matched_question)}</td>
                        <td>${escapeHTML(stat.original_questions)}</td>
                        <td class="text-center">${stat.total_feedback}</td>
                        <td class="text-center">${stat.positive_feedback}</td>
                        <td class="text-center">
                            <span class="badge bg-${getEffectivenessBadgeColor(stat.effectiveness)}">${stat.effectiveness.toFixed(2)}%</span>
                        </td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary me-2" 
                                data-id="${stat._id}" 
                                data-question="${escapeHTML(stat.matched_question)}" 
                                onclick="showEditQuestionForm(this)">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        </td>
                    </tr>
                `).join('');
        }
    } catch (error) {
        console.error('Error fetching answer feedback stats:', error);
        const statsTableBody = document.getElementById('answer-feedback-stats-body');
        if (statsTableBody) {
            statsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading answer feedback statistics: ${error.message}</td></tr>`;
        }
    }
}

export function getEffectivenessBadgeColor(effectiveness) {
    if (effectiveness >= 80) return 'success';
    if (effectiveness >= 60) return 'info';
    if (effectiveness >= 40) return 'warning';
    return 'danger';
}

export async function fetchAndDisplayStatistics() {
    try {
        console.log('Fetching overall statistics...');
        const overallResponse = await fetch('/api/overall_statistics');
        if (!overallResponse.ok) {
            throw new Error(`HTTP error! status: ${overallResponse.status}`);
        }
        const overallStats = await overallResponse.json();
        console.log('Overall statistics fetched:', overallStats);

        console.log('Displaying overall statistics...');
        displayOverallStats(overallStats);

        console.log('Fetching and displaying answer feedback statistics...');
        await showAnswerFeedbackStats();
    } catch (error) {
        console.error('Error fetching statistics:', error);
        alert('An error occurred while fetching statistics. Please try again.');
    }
}

/**
 * Displays overall statistics and charts.
 *
 * @async
 * @function showStatistics
 */
export async function showStatistics() {
    console.log('showStatistics called');
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Main content element not found');
        return;
    }

    // Create the statistics content
    mainContent.innerHTML = `
            <h2>Statistics</h2>
            <div id="overall-stats"></div>
            <div class="card shadow-sm mt-4">
                <div class="card-body">
                    <h5 class="card-title">User Growth</h5>
                    <canvas id="userGrowthChart"></canvas>
                </div>
            </div>
            <div class="card shadow-sm mt-4">
                <div class="card-body">
                    <h5 class="card-title mongodb-text">Answer Feedback Statistics</h5>
                    <div class="table-responsive">
                        <table class="table table-hover table-striped table">
                            <thead class="table-primary">
                                <tr>
                                    <th>Matched Question</th>
                                    <th>Original Questions</th>
                                    <th>Total Feedback</th>
                                    <th>Positive Feedback</th>
                                    <th>Effectiveness</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="answer-feedback-stats-body">
                                <tr><td colspan="6" class="text-center">Loading answer feedback statistics...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div id="statistics" class="tab-pane fade" role="tabpanel" aria-labelledby="statistics-tab">
        <h2>Statistics</h2>
        <div class="row mt-4 mb-4">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">Overall Statistics</h5>
                        <div id="overall-stats" class="row">
                            <!-- Overall stats will be inserted here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="card shadow-sm mt-4">
            <div class="card-body">
                <h5 class="card-title">User Growth</h5>
                <canvas id="userGrowthChart"></canvas>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title mongodb-text">Answer Feedback Statistics</h5>
                        <div class="table-responsive">
                            <table class="table table">
                                <thead>
                                    <tr>
                                        <th>Matched Question</th>
                                        <th>Original Questions</th>
                                        <th>Total Feedback</th>
                                        <th>Positive Feedback</th>
                                        <th>Effectiveness</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="statistics-table-body">
                                    <tr>
                                        <td colspan="6">Loading statistics...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        `;

    // Now fetch and display the statistics
    await fetchAndDisplayStatistics();
    // Use setTimeout to ensure the DOM has updated
    setTimeout(() => {
        createUserGrowthChart();
    }, 0);
}

export function displayOverallStats(stats) {
    const overallStatsContainer = document.getElementById('overall-stats');
    if (!overallStatsContainer) {
        console.error('Overall stats container not found');
        return;
    }

    overallStatsContainer.innerHTML = `
            <div class="card mb-4 shadow-sm">
                <div class="card-body">
                    <h5 class="card-title">Overall Statistics</h5>
                    <div class="row">
                        <div class="col-md-4 col-lg-2 mb-3">
                            <div class="stat-item">
                                <div class="stat-label">Total Users</div>
                                <div class="stat-value">${stats.total_users}</div>
                            </div>
                        </div>
                        <div class="col-md-4 col-lg-2 mb-3">
                            <div class="stat-item">
                                <div class="stat-label">Total Questions</div>
                                <div class="stat-value">${stats.total_questions}</div>
                            </div>
                        </div>
                        <div class="col-md-4 col-lg-2 mb-3">
                            <div class="stat-item">
                                <div class="stat-label">Answered Questions</div>
                                <div class="stat-value">${stats.answered_questions}</div>
                            </div>
                        </div>
                        <div class="col-md-4 col-lg-2 mb-3">
                            <div class="stat-item">
                                <div class="stat-label">Unanswered Questions</div>
                                <div class="stat-value">${stats.unanswered_questions}</div>
                            </div>
                        </div>
                        <div class="col-md-4 col-lg-2 mb-3">
                            <div class="stat-item">
                                <div class="stat-label">Average Feedback Rating</div>
                                <div class="stat-value">${stats.average_rating} (${stats.rating_count} ratings)</div>
                            </div>
                        </div>
                        <div class="col-md-4 col-lg-2 mb-3">
                            <div class="stat-item">
                                <div class="stat-label">Positive Answer Feedback</div>
                                <div class="stat-value">${stats.positive_feedback_percentage}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
}

/**
 * Creates and displays the user growth chart.
 *
 * @function createUserGrowthChart
 * @throws {Error} If there's an issue creating the chart
 */
export function createUserGrowthChart() {
    const canvas = document.getElementById('userGrowthChart');
    if (!canvas) {
        console.error('User growth chart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2D context for canvas');
        return;
    }

    fetch('/api/user_growth')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data || !Array.isArray(data) || data.length === 0) {
                console.error('Invalid or empty data received for user growth chart');
                return;
            }

            const validData = data.filter(item => item._id && item.count);

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: validData.map(item => new Date(item._id)),
                    datasets: [{
                        label: 'New Users',
                        data: validData.map(item => ({ x: new Date(item._id), y: item.count })),
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day'
                            },
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of New Users'
                            }
                        }
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error creating user growth chart:', error);
        });
}