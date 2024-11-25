const cluster = require('node:cluster');
const http = require('http');
const os = require('os');
const process = require('process');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const PORT = process.env.PORT || 3000;
const numCPUs = os.cpus().length;

const setupWorker = () => {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        maxHttpBufferSize: MAX_FILE_SIZE
    });

    app.use(express.json(), cors(), express.static(path.join(__dirname, 'public')));

    const activeTransfers = new Map();

    const handleFileTransferStart = (socket, { room, userName, fileName, fileSize, fileType }) => {
        if (fileSize > MAX_FILE_SIZE) {
            return socket.emit('file-transfer-error', 'File size exceeds 100 MB limit');
        }

        const fileId = `${socket.id}-${Date.now()}`;
        activeTransfers.set(fileId, { 
            room, 
            userName, 
            fileName, 
            fileSize, 
            fileType, 
            chunks: [],
            startTime: Date.now()
        });
        socket.emit('file-transfer-ready', { fileId });
    };

    const handleFileChunk = (socket, { fileId, chunk, chunkIndex, isLastChunk }) => {
        const transfer = activeTransfers.get(fileId);
        if (!transfer) {
            return socket.emit('file-transfer-error', 'Invalid file transfer');
        }

        try {
            transfer.chunks.push(chunk);

            if (isLastChunk) {
                const fileContent = Buffer.concat(transfer.chunks);
                const transferTime = Date.now() - transfer.startTime;

                io.to(transfer.room).emit('fileMessage', {
                    user: transfer.userName,
                    fileName: transfer.fileName,
                    fileSize: transfer.fileSize,
                    fileType: transfer.fileType,
                    fileContent: fileContent.toString('base64'),
                    transferTime
                });

                activeTransfers.delete(fileId);
            }
            socket.emit('chunk-received', { fileId, chunkIndex });
        } catch (error) {
            console.error('File chunk processing error:', error);
            socket.emit('file-transfer-error', 'Chunk processing failed');
        }
    };

    io.on('connection', (socket) => {
        socket.on('joinRoom', ({ room, userName }) => {
            socket.join(room);
            socket.to(room).emit('message', { 
                user: 'GHOST💀', 
                text: `${userName} has joined the room.` 
            });
        });

        socket.on('chatMessage', ({ room, userName, message }) => {
            io.to(room).emit('message', { user: userName, text: message });
        });

        socket.on('start-file-transfer', (data) => handleFileTransferStart(socket, data));
        socket.on('file-chunk', (data) => handleFileChunk(socket, data));
    });

    server.listen(PORT, () => {
        console.log(`Worker ${process.pid} running on port ${PORT}`);
    });
};

if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} exited`);
        cluster.fork();
    });
} else {
    setupWorker();
}