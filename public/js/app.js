// Main Application Controller
class KanbanApp {
    constructor() {
        this.currentScreen = 'auth';
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeApp();
    }

    bindEvents() {
        // Logout buttons
        document.getElementById('logoutBtn').addEventListener('click', () => {
            window.authManager.logout();
        });

        document.getElementById('logoutBoardBtn').addEventListener('click', () => {
            window.authManager.logout();
        });

        // Modal close on outside click
        document.getElementById('createBoardModal').addEventListener('click', (e) => {
            if (e.target.id === 'createBoardModal') {
                window.boardManager.hideCreateBoardModal();
            }
        });

        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') {
                window.boardManager.hideTaskModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key to close modals
            if (e.key === 'Escape') {
                this.closeModals();
            }

            // Enter key in modals
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                if (document.getElementById('createBoardModal').style.display === 'block') {
                    if (e.target.id === 'boardName' || e.target.id === 'boardDescription') {
                        e.preventDefault();
                        window.boardManager.createBoard();
                    }
                }
                if (document.getElementById('taskModal').style.display === 'block') {
                    if (e.target.id === 'taskInput' && !e.shiftKey) {
                        e.preventDefault();
                        window.boardManager.saveTask();
                    }
                }
            }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.screen) {
                this.showScreen(e.state.screen, false);
            }
        });
    }

    initializeApp() {
        // Check if user is authenticated
        if (window.authManager.isAuthenticated()) {
            this.showScreen('dashboard');
            this.displayWelcomeMessage();
            window.boardManager.loadBoards();
        } else {
            this.showScreen('auth');
        }
    }

    showScreen(screenName, updateHistory = true) {
        // Hide all screens
        document.getElementById('authScreen').classList.remove('active');
        document.getElementById('dashboard').classList.remove('active');
        document.getElementById('kanbanBoard').classList.remove('active');

        // Show target screen
        const targetScreen = document.getElementById(this.getScreenId(screenName));
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenName;

            // Update browser history
            if (updateHistory) {
                const state = { screen: screenName };
                const url = screenName === 'auth' ? '/' : `/${screenName}`;
                history.pushState(state, '', url);
            }

            // Screen-specific actions
            this.onScreenChange(screenName);
        }
    }

    getScreenId(screenName) {
        const screenMap = {
            'auth': 'authScreen',
            'dashboard': 'dashboard',
            'kanban': 'kanbanBoard'
        };
        return screenMap[screenName] || 'authScreen';
    }

    onScreenChange(screenName) {
        switch (screenName) {
            case 'auth':
                // Focus on username field
                setTimeout(() => {
                    document.getElementById('username').focus();
                }, 100);
                break;
                
            case 'dashboard':
                // Update welcome message
                this.displayWelcomeMessage();
                // Load boards if not already loaded
                if (window.boardManager.boards.length === 0) {
                    window.boardManager.loadBoards();
                }
                break;
                
            case 'kanban':
                // Board-specific initialization is handled in boardManager.openBoard()
                break;
        }
    }

    displayWelcomeMessage() {
        const user = window.authManager.getUser();
        if (user) {
            const welcomeEl = document.getElementById('welcomeUser');
            welcomeEl.textContent = `Welcome, ${user.username}!`;
        }
    }

    closeModals() {
        const createBoardModal = document.getElementById('createBoardModal');
        const taskModal = document.getElementById('taskModal');
        
        if (createBoardModal.style.display === 'block') {
            window.boardManager.hideCreateBoardModal();
        }
        
        if (taskModal.style.display === 'block') {
            window.boardManager.hideTaskModal();
        }
    }

    // Utility methods
    showGlobalMessage(message, type = 'info', duration = 3000) {
        const messageEl = document.createElement('div');
        messageEl.className = `global-message ${type}`;
        messageEl.textContent = message;
        
        // Style the message
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideInDown 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            ${this.getMessageColor(type)}
        `;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.style.animation = 'slideOutUp 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.remove();
                }
            }, 300);
        }, duration);
    }

    getMessageColor(type) {
        const colors = {
            'success': 'background: linear-gradient(45deg, #27ae60, #2ecc71);',
            'error': 'background: linear-gradient(45deg, #e74c3c, #c0392b);',
            'warning': 'background: linear-gradient(45deg, #f39c12, #e67e22);',
            'info': 'background: linear-gradient(45deg, #3498db, #2980b9);'
        };
        return colors[type] || colors.info;
    }

    // Loading state management
    showLoading(element) {
        if (element) {
            element.classList.add('loading');
        }
    }

    hideLoading(element) {
        if (element) {
            element.classList.remove('loading');
        }
    }

    // API request wrapper with error handling
    async apiRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.authManager.getToken()}`
            }
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, finalOptions);
            
            // Handle token expiration
            if (response.status === 401) {
                this.showGlobalMessage('Session expired. Please log in again.', 'warning');
                window.authManager.logout();
                return null;
            }

            return response;
        } catch (error) {
            console.error('API request failed:', error);
            this.showGlobalMessage('Network error. Please check your connection.', 'error');
            return null;
        }
    }

    // Responsive helper
    isMobile() {
        return window.innerWidth <= 768;
    }

    // Initialize responsive behavior
    handleResize() {
        if (this.isMobile() && this.currentScreen === 'kanban') {
            // Mobile-specific adjustments for kanban board
            document.querySelectorAll('.column').forEach(column => {
                column.style.minWidth = '280px';
            });
        }
    }
}

// Add CSS animations dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInDown {
        from {
            opacity: 0;
            transform: translate(-50%, -30px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }

    @keyframes slideOutUp {
        from {
            opacity: 1;
            transform: translate(-50%, 0);
        }
        to {
            opacity: 0;
            transform: translate(-50%, -30px);
        }
    }

    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(30px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    .screen {
        display: none;
    }

    .screen.active {
        display: block;
    }

    /* Loading overlay */
    .loading {
        position: relative;
        pointer-events: none;
        opacity: 0.6;
    }

    .loading::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        border: 2px solid #667eea;
        border-top: 2px solid transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        z-index: 1000;
    }

    @keyframes spin {
        to { transform: translate(-50%, -50%) rotate(360deg); }
    }
`;

document.head.appendChild(style);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new KanbanApp();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        window.app.handleResize();
    });
});

// Make app globally available
window.KanbanApp = KanbanApp;
