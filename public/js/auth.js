class Auth {
    constructor() {
        this.token = null;
        this.user = null;
        this.init();
    }

    init() {
        const authContainer = document.getElementById('auth-container');
        authContainer.innerHTML = `
            <div class="auth-container">
                <h2>Login</h2>
                <input type="text" id="username" placeholder="Username">
                <input type="password" id="password" placeholder="Password">
                <button onclick="auth.handleLogin()">Login</button>
                <button onclick="auth.handleRegister()">Register</button>
            </div>
        `;
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            
            if (data.error) {
                alert(data.error);
                return;
            }

            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('token', data.token);
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('board-container').style.display = 'block';
            boardManager.init();
        } catch (error) {
            alert('Error logging in');
        }
    }

    async handleRegister() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const email = prompt('Enter email:');

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email })
            });
            const data = await response.json();
            
            if (data.error) {
                alert(data.error);
                return;
            }

            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('token', data.token);
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('board-container').style.display = 'block';
            boardManager.init();
        } catch (error) {
            alert('Error registering');
        }
    }
}

const auth = new Auth();
