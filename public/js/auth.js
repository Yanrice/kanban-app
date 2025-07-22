// Authentication handling
class AuthManager {
    constructor() {
        this.isLoginMode = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateFormMode();
    }

    bindEvents() {
        const authForm = document.getElementById('authForm');
        const authToggleBtn = document.getElementById('authToggleBtn');

        authForm.addEventListener('submit', (e) => this.handleSubmit(e));
        authToggleBtn.addEventListener('click', () => this.toggleMode());
    }

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        this.updateFormMode();
    }

    updateFormMode() {
        const authSubmit = document.getElementById('authSubmit');
        const authToggleText = document.getElementById('authToggleText');
        const authToggleBtn = document.getElementById('authToggleBtn');
        const emailGroup = document.getElementById('email').parentElement;

        if (this.isLoginMode) {
            // Login mode
            authSubmit.textContent = 'Sign In';
            authToggleText.textContent = "Don't have an account?";
            authToggleBtn.textContent = 'Sign Up';
            emailGroup.style.display = 'none';
            document.getElementById('email').required = false;
        } else {
            // Register mode
            authSubmit.textContent = 'Sign Up';
            authToggleText.textContent = 'Already have an account?';
            authToggleBtn.textContent = 'Sign In';
            emailGroup.style.display = 'block';
            document.getElementById('email').required = true;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        const submitBtn = document.getElementById('authSubmit');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Loading...';
        submitBtn.disabled = true;

        try {
            const endpoint = this.isLoginMode ? '/api/auth/login' : '/api/auth/register';
            const body = this.isLoginMode ? 
                { username, password } : 
                { username, email, password };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                // Store token and user info
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Show success message
                this.showMessage('Success! Welcome to Kanban Board', 'success');
                
                // Navigate to dashboard
                setTimeout(() => {
                    window.app.showScreen('dashboard');
                }, 1000);
            } else {
                this.showMessage(data.message || 'Authentication failed', 'error');
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.showMessage('Connection error. Please try again.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    showMessage(message, type) {
        // Create temporary message element
        const messageEl = document.createElement('div');
        messageEl.className = `auth-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideInDown 0.3s ease;
            background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        `;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.app.showScreen('auth');
    }

    isAuthenticated() {
        return !!localStorage.getItem('token');
    }

    getToken() {
        return localStorage.getItem('token');
    }

    getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }
}

// Initialize auth manager
window.authManager = new AuthManager();
