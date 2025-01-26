function getNextClass() {
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDay = days[now.getDay()];
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // If it's Saturday or Sunday, start from Monday
    if (currentDay === 'Sat' || currentDay === 'Sun') {
        const nextDay = 'Mon';
        const timeSlots = Object.keys(schedule);
        for (let timeSlot of timeSlots) {
            const slotStart = timeSlot.split('-')[0].trim();
            const classForDay = schedule[timeSlot][nextDay];
            if (classForDay) {
                return `Next class:<br>${classForDay} ${slotStart} ${nextDay.slice(0,3)}`;
            }
        }
    }

    // Sort time slots
    const timeSlots = Object.keys(schedule).sort((a, b) => {
        const timeA = a.split('-')[0].trim();
        const timeB = b.split('-')[0].trim();
        return timeA.localeCompare(timeB);
    });

    // Find next class today
    for (let timeSlot of timeSlots) {
        const slotStart = timeSlot.split('-')[0].trim();
        if (slotStart > currentTime) {
            const classForDay = schedule[timeSlot][currentDay];
            if (classForDay) {
                return `Next class:<br>${classForDay} ${slotStart}`;
            }
        }
    }

    // If no more classes today, find first class of next day
    for (let i = 1; i <= 7; i++) {
        const nextDay = days[(now.getDay() + i) % 7];
        for (let timeSlot of timeSlots) {
            const slotStart = timeSlot.split('-')[0].trim();
            const classForDay = schedule[timeSlot][nextDay];
            if (classForDay) {
                return `Next class:<br>${classForDay} ${slotStart} ${nextDay.slice(0,3)}`;
            }
        }
    }

    return 'Next class:<br>No upcoming classes';
}

function updateScheduleDisplay() {
    const scheduleElement = document.querySelector('l.schedule#schedule');
    if (scheduleElement) {
        scheduleElement.innerHTML = getNextClass();
    }
}

updateScheduleDisplay();
setInterval(updateScheduleDisplay, 60000);