const socket = io();

// Elements
const landingPage = document.getElementById('landing-page');
const roomSelectionPage = document.getElementById('room-selection-page');
const chatRoomPage = document.getElementById('chat-room-page');
const usernameInput = document.getElementById('username');
const startChatBtn = document.getElementById('start-chat');
const displayName = document.getElementById('display-name');
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const roomInput = document.getElementById('room-id');
const roomName = document.getElementById('room-name');
const leaveRoomBtn = document.getElementById('leave-room');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message');
const sendMessageBtn = document.getElementById('send-message');
const fileInput = document.getElementById('file-input');
const sendFileBtn = document.getElementById('send-file');
const fileProgress = document.getElementById('file-progress');
const progressBar = document.querySelector('#progress-bar div');
const progressText = document.getElementById('progress-text');

let userName = '';
let currentRoom = '';

// Add event listeners for Enter key presses
usernameInput.addEventListener('keypress', handleUsernameEnter);
roomInput.addEventListener('keypress', handleRoomEnter);

// Start Chat
startChatBtn.addEventListener('click', startChat);

function startChat() {
    userName = usernameInput.value.trim();
    if (!userName) {
        alert('Please enter your hacker alias');
        return;
    }
    displayName.textContent = userName;
    landingPage.classList.add('hidden');
    roomSelectionPage.classList.remove('hidden');
}

// Create Room
createRoomBtn.addEventListener('click', () => {
    currentRoom = `Room-${Math.random().toString(36).substr(2, 6)}`;
    joinRoom();
});

// Join Room
joinRoomBtn.addEventListener('click', joinRoom);

// Join Room Functionality
function joinRoom() {
    if (!currentRoom) {
        currentRoom = roomInput.value.trim();
        if (!currentRoom) {
            alert('Please enter a Channel ID');
            return;
        }
    }
    roomName.textContent = currentRoom;
    roomSelectionPage.classList.add('hidden');
    chatRoomPage.classList.remove('hidden');
    socket.emit('joinRoom', { room: currentRoom, userName });
}

// Send Chat Message
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    socket.emit('chatMessage', { room: currentRoom, userName, message });
    messageInput.value = '';
}

// Updated message display function
socket.on('message', ({ user, text }) => {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    if (user === userName) {
        messageContainer.classList.add('own-message');
    }

    const userElement = document.createElement('div');
    userElement.className = 'message-user';
    userElement.textContent = user;

    const messageElement = document.createElement('div');
    messageElement.className = 'message-content';
    messageElement.textContent = text;

    messageContainer.appendChild(userElement);
    messageContainer.appendChild(messageElement);
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Send File
sendFileBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const maxFileSize = 100 * 1024 * 1024; // 100 MB
    if (file.size > maxFileSize) {
        alert('File size exceeds the limit of 100 MB. Please choose a smaller file.');
        return;
    }

    const chunkSize = 100 * 1024; // 100 KB chunks
    let offset = 0;

    fileProgress.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    socket.emit('start-file-transfer', {
        room: currentRoom,
        userName,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
    });

    socket.on('file-transfer-ready', ({ fileId }) => {
        const reader = new FileReader();
        let chunkIndex = 0;

        reader.onload = (e) => {
            const chunk = e.target.result;
            const isLastChunk = offset + chunkSize >= file.size;
            
            socket.emit('file-chunk', {
                fileId,
                chunk,
                chunkIndex,
                isLastChunk
            });

            const progress = Math.min(100, (offset / file.size) * 100);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;

            if (!isLastChunk) {
                offset += chunkSize;
                chunkIndex++;
                readNextChunk();
            } else {
                // Hide progress bar when file transfer is complete
                setTimeout(() => {
                    fileProgress.classList.add('hidden');
                }, 1000); // Delay hiding for 1 second to show 100% briefly
            }
        };

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        };

        readNextChunk();
    });
});

// Add error handler for file transfer failures
socket.on('file-transfer-error', (error) => {
    alert(`File transfer failed: ${error}`);
    fileProgress.classList.add('hidden');
});

socket.on('fileMessage', ({ user, fileName, fileType, fileContent }) => {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    if (user === userName) {
        messageContainer.classList.add('own-message');
    }

    const userElement = document.createElement('div');
    userElement.className = 'message-user';
    userElement.textContent = user;

    const fileElement = document.createElement('div');
    fileElement.className = 'message-content';
    fileElement.innerHTML = `<a href="data:${fileType};base64,${fileContent}" download="${fileName}">${fileName}</a>`;

    messageContainer.appendChild(userElement);
    messageContainer.appendChild(fileElement);
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Leave Room
leaveRoomBtn.addEventListener('click', () => {
    chatRoomPage.classList.add('hidden');
    roomSelectionPage.classList.remove('hidden');
    currentRoom = '';
    messagesDiv.innerHTML = '';
});

// Functions to handle Enter key presses
function handleUsernameEnter(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        startChat();
    }
}

function handleRoomEnter(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        joinRoom();
    }
}

