// Board and Task Management
class BoardManager {
    constructor() {
        this.currentBoard = null;
        this.boards = [];
        this.tasks = [];
        this.draggedTask = null;
        this.currentTaskId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.initDragAndDrop();
    }

    bindEvents() {
        // Board creation
        document.getElementById('newBoardBtn').addEventListener('click', () => this.showCreateBoardModal());
        document.getElementById('createBoardCard').addEventListener('click', () => this.showCreateBoardModal());
        document.getElementById('createBoardSubmitBtn').addEventListener('click', () => this.createBoard());
        document.getElementById('cancelBoardBtn').addEventListener('click', () => this.hideCreateBoardModal());

        // Task management
        document.getElementById('saveTaskBtn').addEventListener('click', () => this.saveTask());
        document.getElementById('cancelTaskBtn').addEventListener('click', () => this.hideTaskModal());

        // Add task buttons
        document.querySelectorAll('.add-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const column = e.target.getAttribute('data-column');
                this.showTaskModal(column);
            });
        });

        // Navigation
        document.getElementById('backToBoardsBtn').addEventListener('click', () => this.backToBoards());
    }

    // Board Management
    showCreateBoardModal() {
        document.getElementById('createBoardModal').style.display = 'block';
        document.getElementById('boardName').focus();
    }

    hideCreateBoardModal() {
        document.getElementById('createBoardModal').style.display = 'none';
        document.getElementById('boardName').value = '';
        document.getElementById('boardDescription').value = '';
    }

    async createBoard() {
        const name = document.getElementById('boardName').value.trim();
        const description = document.getElementById('boardDescription').value.trim();

        if (!name) {
            alert('Please enter a board name');
            return;
        }

        try {
            const response = await fetch('/api/boards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.authManager.getToken()}`
                },
                body: JSON.stringify({ name, description })
            });

            const data = await response.json();

            if (response.ok) {
                this.hideCreateBoardModal();
                await this.loadBoards();
                this.showMessage('Board created successfully!', 'success');
            } else {
                this.showMessage(data.message || 'Failed to create board', 'error');
            }
        } catch (error) {
            console.error('Create board error:', error);
            this.showMessage('Failed to create board', 'error');
        }
    }

    async loadBoards() {
        try {
            const response = await fetch('/api/boards', {
                headers: {
                    'Authorization': `Bearer ${window.authManager.getToken()}`
                }
            });

            if (response.ok) {
                this.boards = await response.json();
                this.renderBoards();
            }
        } catch (error) {
            console.error('Load boards error:', error);
        }
    }

    renderBoards() {
        const boardGrid = document.getElementById('boardGrid');
        const createCard = document.getElementById('createBoardCard');
        
        // Clear existing boards (except create card)
        const existingBoards = boardGrid.querySelectorAll('.board-card:not(.create-board-card)');
        existingBoards.forEach(board => board.remove());

        this.boards.forEach(board => {
            const boardEl = document.createElement('div');
            boardEl.className = 'board-card';
            boardEl.innerHTML = `
                <div class="board-actions">
                    <button class="board-btn delete-board" data-id="${board.id}">✕</button>
                </div>
                <h3>${this.escapeHtml(board.name)}</h3>
                <p>${this.escapeHtml(board.description || 'No description')}</p>
                <div class="board-meta">
                    <span>Created: ${new Date(board.created_at).toLocaleDateString()}</span>
                    <span>${board.task_count || 0} tasks</span>
                </div>
            `;

            boardEl.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-board')) {
                    this.openBoard(board);
                }
            });

            // Delete board functionality
            const deleteBtn = boardEl.querySelector('.delete-board');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteBoard(board.id);
            });

            boardGrid.insertBefore(boardEl, createCard);
        });
    }

    async deleteBoard(boardId) {
        if (!confirm('Are you sure you want to delete this board?')) return;

        try {
            const response = await fetch(`/api/boards/${boardId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${window.authManager.getToken()}`
                }
            });

            if (response.ok) {
                await this.loadBoards();
                this.showMessage('Board deleted successfully', 'success');
            }
        } catch (error) {
            console.error('Delete board error:', error);
            this.showMessage('Failed to delete board', 'error');
        }
    }

    openBoard(board) {
        this.currentBoard = board;
        document.getElementById('currentBoardTitle').textContent = board.name;
        window.app.showScreen('kanban');
        this.loadTasks();
    }

    backToBoards() {
        this.currentBoard = null;
        window.app.showScreen('dashboard');
    }

    // Task Management
    showTaskModal(column, task = null) {
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('taskModalTitle');
        const input = document.getElementById('taskInput');
        const priority = document.getElementById('taskPriority');

        if (task) {
            title.textContent = 'Edit Task';
            input.value = task.title;
            priority.value = task.priority;
            this.currentTaskId = task.id;
        } else {
            title.textContent = 'Add New Task';
            input.value = '';
            priority.value = 'medium';
            this.currentTaskId = null;
        }

        this.currentColumn = column;
        modal.style.display = 'block';
        input.focus();
    }

    hideTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        this.currentTaskId = null;
        this.currentColumn = null;
    }

    async saveTask() {
        const title = document.getElementById('taskInput').value.trim();
        const priority = document.getElementById('taskPriority').value;

        if (!title) {
            alert('Please enter a task description');
            return;
        }

        try {
            const url = this.currentTaskId ? 
                `/api/tasks/${this.currentTaskId}` : 
                '/api/tasks';
            
            const method = this.currentTaskId ? 'PUT' : 'POST';
            
            const body = {
                title,
                priority,
                board_id: this.currentBoard.id,
                status: this.currentColumn
            };

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.authManager.getToken()}`
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                this.hideTaskModal();
                await this.loadTasks();
                this.showMessage(this.currentTaskId ? 'Task updated!' : 'Task created!', 'success');
            }
        } catch (error) {
            console.error('Save task error:', error);
            this.showMessage('Failed to save task', 'error');
        }
    }

    async loadTasks() {
        if (!this.currentBoard) return;

        try {
            const response = await fetch(`/api/boards/${this.currentBoard.id}/tasks`, {
                headers: {
                    'Authorization': `Bearer ${window.authManager.getToken()}`
                }
            });

            if (response.ok) {
                this.tasks = await response.json();
                this.renderTasks();
            }
        } catch (error) {
            console.error('Load tasks error:', error);
        }
    }

    renderTasks() {
        const columns = ['todo', 'in-progress', 'done'];
        
        columns.forEach(column => {
            const taskList = document.getElementById(`${column}-list`);
            const taskCount = taskList.parentElement.querySelector('.task-count');
            const tasks = this.tasks.filter(task => task.status === column);
            
            taskList.innerHTML = '';
            taskCount.textContent = tasks.length;

            tasks.forEach(task => {
                const taskEl = this.createTaskElement(task);
                taskList.appendChild(taskEl);
            });
        });
    }

    createTaskElement(task) {
        const taskEl = document.createElement('div');
        taskEl.className = `task priority-${task.priority}`;
        taskEl.draggable = true;
        taskEl.dataset.taskId = task.id;
        
        taskEl.innerHTML = `
            <div class="task-content">${this.escapeHtml(task.title)}</div>
            <div class="task-meta">
                <span class="task-priority priority-${task.priority}">${task.priority}</span>
                <div class="task-actions">
                    <button class="task-btn edit-task">✎</button>
                    <button class="task-btn delete-task">✕</button>
                </div>
            </div>
        `;

        // Edit task
        taskEl.querySelector('.edit-task').addEventListener('click', () => {
            this.showTaskModal(task.status, task);
        });

        // Delete task
        taskEl.querySelector('.delete-task').addEventListener('click', () => {
            this.deleteTask(task.id);
        });

        return taskEl;
    }

    async deleteTask(taskId) {
        if (!confirm('Delete this task?')) return;

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${window.authManager.getToken()}`
                }
            });

            if (response.ok) {
                await this.loadTasks();
                this.showMessage('Task deleted', 'success');
            }
        } catch (error) {
            console.error('Delete task error:', error);
        }
    }

    // Drag and Drop
    initDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('task')) {
                this.draggedTask = e.target;
                e.target.classList.add('dragging');
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('task')) {
                e.target.classList.remove('dragging');
                this.draggedTask = null;
            }
        });

        document.querySelectorAll('.task-list').forEach(list => {
            list.addEventListener('dragover', (e) => {
                e.preventDefault();
                list.classList.add('drag-over');
            });

            list.addEventListener('dragleave', (e) => {
                if (!list.contains(e.relatedTarget)) {
                    list.classList.remove('drag-over');
                }
            });

            list.addEventListener('drop', (e) => {
                e.preventDefault();
                list.classList.remove('drag-over');
                
                if (this.draggedTask) {
                    const newStatus = list.id.replace('-list', '');
                    this.moveTask(this.draggedTask.dataset.taskId, newStatus);
                }
            });
        });
    }

    async moveTask(taskId, newStatus) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.authManager.getToken()}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                await this.loadTasks();
            }
        } catch (error) {
            console.error('Move task error:', error);
        }
    }

    showMessage(message, type) {
        const messageEl = document.createElement('div');
        messageEl.className = `board-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        `;

        document.body.appendChild(messageEl);
        setTimeout(() => messageEl.remove(), 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize board manager
window.boardManager = new BoardManager();
