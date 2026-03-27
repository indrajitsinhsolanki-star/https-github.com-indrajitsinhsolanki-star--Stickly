import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { nanoid } from "nanoid";

interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  author: string;
  timestamp: number;
  votes: number;
}

interface Room {
  notes: Map<string, Note>;
  users: Map<string, { name: string; color: string }>;
}

const rooms = new Map<string, Room>();

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;

  // WebSocket logic
  wss.on("connection", (ws: WebSocket & { roomId?: string; userId?: string }) => {
    ws.userId = nanoid();

    ws.on("message", (data: string) => {
      const message = JSON.parse(data);

      switch (message.type) {
        case "join": {
          const { roomId, name, color } = message.payload;
          ws.roomId = roomId;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, { notes: new Map(), users: new Map() });
          }

          const room = rooms.get(roomId)!;
          room.users.set(ws.userId!, { name, color });

          // Send initial state
          ws.send(JSON.stringify({
            type: "init",
            payload: {
              notes: Array.from(room.notes.values()),
              users: Array.from(room.users.entries()).map(([id, u]) => ({ id, ...u })),
              userId: ws.userId
            }
          }));

          // Broadcast join
          broadcast(roomId, {
            type: "user:joined",
            payload: { id: ws.userId!, name, color }
          }, ws);
          break;
        }

        case "note:create": {
          if (!ws.roomId) return;
          const room = rooms.get(ws.roomId);
          if (!room) return;

          const note: Note = {
            ...message.payload,
            id: nanoid(),
            timestamp: Date.now(),
            votes: 0
          };
          room.notes.set(note.id, note);

          broadcast(ws.roomId, {
            type: "note:created",
            payload: note
          });
          break;
        }

        case "note:update": {
          if (!ws.roomId) return;
          const room = rooms.get(ws.roomId);
          if (!room) return;

          const { id, ...updates } = message.payload;
          const note = room.notes.get(id);
          if (note) {
            Object.assign(note, updates);
            broadcast(ws.roomId, {
              type: "note:updated",
              payload: note
            }, ws);
          }
          break;
        }

        case "note:upvote": {
          if (!ws.roomId) return;
          const room = rooms.get(ws.roomId);
          if (!room) return;

          const { id } = message.payload;
          const note = room.notes.get(id);
          if (note) {
            note.votes += 1;
            broadcast(ws.roomId, {
              type: "note:updated",
              payload: note
            });
          }
          break;
        }

        case "note:delete": {
          if (!ws.roomId) return;
          const room = rooms.get(ws.roomId);
          if (!room) return;

          const { id } = message.payload;
          if (room.notes.has(id)) {
            room.notes.delete(id);
            broadcast(ws.roomId, {
              type: "note:deleted",
              payload: { id }
            });
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      if (ws.roomId && rooms.has(ws.roomId)) {
        const room = rooms.get(ws.roomId)!;
        room.users.delete(ws.userId!);
        broadcast(ws.roomId, {
          type: "user:left",
          payload: { id: ws.userId! }
        });
      }
    });
  });

  function broadcast(roomId: string, message: any, skipWs?: WebSocket) {
    wss.clients.forEach((client: WebSocket & { roomId?: string }) => {
      if (client !== skipWs && client.readyState === WebSocket.OPEN && client.roomId === roomId) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
