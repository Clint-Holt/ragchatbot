// API base URL - use relative path to work from any host
const API_URL = '/api';

// Global state
let currentSessionId = null;

// DOM elements
let chatMessages, chatInput, sendButton, totalCourses, courseTitles;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements after page loads
    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    sendButton = document.getElementById('sendButton');
    totalCourses = document.getElementById('totalCourses');
    courseTitles = document.getElementById('courseTitles');
    
    setupEventListeners();
    setupModalEventListeners();
    createNewSession();
    loadCourseStats();
});

// Event Listeners
function setupEventListeners() {
    // Chat functionality
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    
    // Suggested questions
    document.querySelectorAll('.suggested-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const question = e.target.getAttribute('data-question');
            chatInput.value = question;
            sendMessage();
        });
    });
}


// Chat Functions
async function sendMessage() {
    const query = chatInput.value.trim();
    if (!query) return;

    // Disable input
    chatInput.value = '';
    chatInput.disabled = true;
    sendButton.disabled = true;

    // Add user message
    addMessage(query, 'user');

    // Add loading message - create a unique container for it
    const loadingMessage = createLoadingMessage();
    chatMessages.appendChild(loadingMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const response = await fetch(`${API_URL}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                session_id: currentSessionId
            })
        });

        if (!response.ok) throw new Error('Query failed');

        const data = await response.json();
        
        // Update session ID if new
        if (!currentSessionId) {
            currentSessionId = data.session_id;
        }

        // Replace loading message with response
        loadingMessage.remove();
        addMessage(data.answer, 'assistant', data.sources);

    } catch (error) {
        // Replace loading message with error
        loadingMessage.remove();
        addMessage(`Error: ${error.message}`, 'assistant');
    } finally {
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.focus();
    }
}

function createLoadingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="loading">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    return messageDiv;
}

function addMessage(content, type, sources = null, isWelcome = false) {
    const messageId = Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}${isWelcome ? ' welcome-message' : ''}`;
    messageDiv.id = `message-${messageId}`;
    
    // Convert markdown to HTML for assistant messages
    const displayContent = type === 'assistant' ? marked.parse(content) : escapeHtml(content);
    
    let html = `<div class="message-content">${displayContent}</div>`;
    
    if (sources && sources.length > 0) {
        const sourceLinks = sources.map((source, index) => {
            return `<span class="source-link" data-source-index="${index}" data-message-id="${messageId}">
                ${escapeHtml(source.display_text)}
                <svg class="source-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            </span>`;
        }).join('');
        
        html += `
            <details class="sources-collapsible">
                <summary class="sources-header">Sources</summary>
                <div class="sources-content">${sourceLinks}</div>
            </details>
        `;
        
        // Store sources data for modal access
        messageDiv.setAttribute('data-sources', JSON.stringify(sources));
    }
    
    messageDiv.innerHTML = html;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add event listeners for source links
    if (sources && sources.length > 0) {
        messageDiv.querySelectorAll('.source-link').forEach(link => {
            link.addEventListener('click', handleSourceLinkClick);
        });
    }
    
    return messageId;
}

// Helper function to escape HTML for user messages
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Removed removeMessage function - no longer needed since we handle loading differently

async function createNewSession() {
    currentSessionId = null;
    chatMessages.innerHTML = '';
    addMessage('Welcome to the Course Materials Assistant! I can help you with questions about courses, lessons and specific content. What would you like to know?', 'assistant', null, true);
}

// Load course statistics
async function loadCourseStats() {
    try {
        console.log('Loading course stats...');
        const response = await fetch(`${API_URL}/courses`);
        if (!response.ok) throw new Error('Failed to load course stats');
        
        const data = await response.json();
        console.log('Course data received:', data);
        
        // Update stats in UI
        if (totalCourses) {
            totalCourses.textContent = data.total_courses;
        }
        
        // Update course titles
        if (courseTitles) {
            if (data.course_titles && data.course_titles.length > 0) {
                courseTitles.innerHTML = data.course_titles
                    .map(title => `<div class="course-title-item">${title}</div>`)
                    .join('');
            } else {
                courseTitles.innerHTML = '<span class="no-courses">No courses available</span>';
            }
        }
        
    } catch (error) {
        console.error('Error loading course stats:', error);
        // Set default values on error
        if (totalCourses) {
            totalCourses.textContent = '0';
        }
        if (courseTitles) {
            courseTitles.innerHTML = '<span class="error">Failed to load courses</span>';
        }
    }
}

// Source Modal Functions
function handleSourceLinkClick(event) {
    const sourceIndex = parseInt(event.currentTarget.getAttribute('data-source-index'));
    const messageId = event.currentTarget.getAttribute('data-message-id');
    const messageElement = document.getElementById(`message-${messageId}`);
    
    if (messageElement) {
        const sourcesData = JSON.parse(messageElement.getAttribute('data-sources'));
        const source = sourcesData[sourceIndex];
        showSourceModal(source);
    }
}

function showSourceModal(source) {
    const modal = document.getElementById('sourceModal');
    const title = document.getElementById('sourceModalTitle');
    const course = document.getElementById('sourceCourse');
    const lessonField = document.getElementById('sourceLessonField');
    const lesson = document.getElementById('sourceLesson');
    const preview = document.getElementById('sourcePreview');
    const originalLink = document.getElementById('sourceOriginalLink');
    
    // Set modal content
    title.textContent = 'Source Details';
    course.textContent = source.course_title;
    
    if (source.lesson_number !== null && source.lesson_number !== undefined) {
        lessonField.style.display = 'block';
        lesson.textContent = `Lesson ${source.lesson_number}`;
    } else {
        lessonField.style.display = 'none';
    }
    
    preview.textContent = source.content_preview;
    
    if (source.lesson_link) {
        originalLink.href = source.lesson_link;
        originalLink.style.display = 'inline-flex';
    } else {
        originalLink.style.display = 'none';
    }
    
    // Show modal
    modal.style.display = 'flex';
    
    // Focus management
    const closeButton = document.getElementById('sourceModalClose');
    closeButton.focus();
}

function hideSourceModal() {
    const modal = document.getElementById('sourceModal');
    modal.style.display = 'none';
}

// Setup modal event listeners
function setupModalEventListeners() {
    const modal = document.getElementById('sourceModal');
    const closeButton = document.getElementById('sourceModalClose');
    const cancelButton = document.getElementById('sourceModalCancel');
    
    // Close modal on button clicks
    closeButton.addEventListener('click', hideSourceModal);
    cancelButton.addEventListener('click', hideSourceModal);
    
    // Close modal on backdrop click
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideSourceModal();
        }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'flex') {
            hideSourceModal();
        }
    });
}