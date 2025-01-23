const time = document.getElementById('time');

function updateTime() {
    time.textContent = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

updateTime();
setInterval(updateTime, 1000);
