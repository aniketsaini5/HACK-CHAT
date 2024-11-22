const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100 MB
});

app.use(express.json());  
app.use(cors());  
app.use(express.static(path.join(__dirname, 'public')));

const activeTransfers = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('joinRoom', ({ room, userName }) => {
        socket.join(room);
        console.log(`${userName} joined room ${room}`);
        socket.to(room).emit('message', { user: 'System', text: `${userName} has joined the room.` });
    });

    socket.on('chatMessage', ({ room, userName, message }) => {
        io.to(room).emit('message', { user: userName, text: message });
    });

    socket.on('start-file-transfer', ({ room, userName, fileName, fileSize, fileType }) => {
        const maxFileSize = 100 * 1024 * 1024; // 100 MB
        if (fileSize > maxFileSize) {
            socket.emit('file-transfer-error', 'File size exceeds the limit of 100 MB');
            return;
        }

        const fileId = `${socket.id}-${Date.now()}`;
        activeTransfers.set(fileId, { room, userName, fileName, fileSize, fileType, chunks: [] });
        socket.emit('file-transfer-ready', { fileId });
    });

    socket.on('file-chunk', ({ fileId, chunk, chunkIndex, isLastChunk }) => {
        const transfer = activeTransfers.get(fileId);
        if (transfer) {
            try {
                transfer.chunks.push(chunk);

                if (isLastChunk) {
                    const fileContent = Buffer.concat(transfer.chunks);
                    io.to(transfer.room).emit('fileMessage', {
                        user: transfer.userName,
                        fileName: transfer.fileName,
                        fileSize: transfer.fileSize,
                        fileType: transfer.fileType,
                        fileContent: fileContent.toString('base64')
                    });
                    activeTransfers.delete(fileId);
                }
                socket.emit('chunk-received', { fileId, chunkIndex });
            } catch (error) {
                console.error('Error processing file chunk:', error);
                socket.emit('file-transfer-error', 'Error processing file chunk');
            }
        } else {
            socket.emit('file-transfer-error', 'Invalid file transfer');
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

