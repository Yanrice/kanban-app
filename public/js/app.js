if (localStorage.getItem('token')) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('board-container').style.display = 'block';
    boardManager.init();
}
