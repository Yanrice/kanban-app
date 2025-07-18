class BoardManager {
    constructor() {
        this.boards = [];
        this.currentBoard = null;
    }

    async init() {
        await this.loadBoards();
        this.render();
    }

    async loadBoards() {
        try {
            const response = await fetch('/api/boards', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            this.boards = await response.json();
        } catch (error) {
            console.error('Error loading boards:', error);
        }
    }

    async loadBoard(boardId) {
        try {
            const response = await fetch(`/api/boards/${boardId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            this.currentBoard = await response.json();
            this.render();
        } catch (error) {
            console.error('Error loading board:', error);
        }
    }

    render() {
        const container = document.getElementById('board-container');
        container.innerHTML = `
            <h2>Boards</h2>
            <button onclick="boardManager.createBoard()">New Board</button>
            <div id="boards-list"></div>
            <div id="board-view" style="display: none;"></div>
        `;

        const boardsList = document.getElementById('boards-list');
        boardsList.innerHTML = this.boards.map(board => `
            <div onclick="boardManager.loadBoard(${board.id})">${board.title}</div>
        `).join('');

        if (this.currentBoard) {
            document.getElementById('board-view').style.display = 'block';
            document.getElementById('board-view').innerHTML = `
                <h3>${this.currentBoard.title}</h3>
                <div class="board">
                    ${this.currentBoard.columns.map(column => `
                        <div class="column">
                            <h4>${column.title}</h4>
                            <button onclick="boardManager.addTask(${column.id})">Add Task</button>
                            ${column.tasks.map(task => `
                                <div class="task">
                                    ${task.title}
                                    <button onclick="boardManager.deleteTask(${task.id})">Delete</button>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    async createBoard() {
        const title = prompt('Enter board title:');
        if (!title) return;

        try {
            const response = await fetch('/api/boards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ title })
            });
            const board = await response.json();
            this.boards.push(board);
            this.render();
        } catch (error) {
            console.error('Error creating board:', error);
        }
    }

    async addTask(columnId) {
        const title = prompt('Enter task title:');
        if (!title) return;

        try {
            const response = await fetch(`/api/columns/${columnId}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ title })
            });
            await this.loadBoard(this.currentBoard.id);
        } catch (error) {
            console.error('Error adding task:', error);
        }
    }

    async deleteTask(taskId) {
        try {
            await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            await this.loadBoard(this.currentBoard.id);
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }
}

const boardManager = new BoardManager();
