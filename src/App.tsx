import React, { useState, useEffect, useRef, useMemo } from "react";
import { Stage, Layer, Rect, Text, Group } from "react-konva";
import { nanoid } from "nanoid";
import { Plus, Users, TrendingUp, X, MessageSquare, Trash2, ArrowBigUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Note, User, Message } from "./types";
import { cn } from "./lib/utils";

const COLORS = [
  "#fef08a", // yellow
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#fecaca", // red
  "#ddd6fe", // purple
  "#fed7aa", // orange
  "#fbcfe8", // pink
];

const USER_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"
];

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [userColor, setUserColor] = useState(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [showSidebar, setShowSidebar] = useState(true);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomId || !name) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      socket.send(JSON.stringify({
        type: "join",
        payload: { roomId, name, color: userColor }
      }));
    };

    socket.onmessage = (event) => {
      const message: Message = JSON.parse(event.data);
      switch (message.type) {
        case "init":
          setNotes(message.payload.notes);
          setUsers(message.payload.users);
          setMyUserId(message.payload.userId);
          break;
        case "note:created":
          setNotes(prev => [...prev, message.payload]);
          break;
        case "note:updated":
          setNotes(prev => prev.map(n => n.id === message.payload.id ? message.payload : n));
          break;
        case "note:deleted":
          setNotes(prev => prev.filter(n => n.id !== message.payload.id));
          break;
        case "user:joined":
          setUsers(prev => [...prev, message.payload]);
          break;
        case "user:left":
          setUsers(prev => prev.filter(u => u.id !== message.payload.id));
          break;
      }
    };

    socket.onclose = () => setIsConnected(false);

    return () => {
      socket.close();
    };
  }, [roomId, name, userColor]);

  const handleAddNote = () => {
    if (!socketRef.current) return;
    
    // Calculate center of screen in stage coordinates
    const centerX = (-stagePos.x + window.innerWidth / 2) / stageScale;
    const centerY = (-stagePos.y + window.innerHeight / 2) / stageScale;

    socketRef.current.send(JSON.stringify({
      type: "note:create",
      payload: {
        text: "New idea...",
        x: centerX - 100,
        y: centerY - 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        author: name
      }
    }));
  };

  const handleUpdateNote = (id: string, updates: Partial<Note>) => {
    if (!socketRef.current) return;
    
    // Optimistic update for position to avoid lag
    if (updates.x !== undefined || updates.y !== undefined) {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    }

    socketRef.current.send(JSON.stringify({
      type: "note:update",
      payload: { id, ...updates }
    }));
  };

  const handleUpvote = (id: string) => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({
      type: "note:upvote",
      payload: { id }
    }));
  };

  const handleDeleteNote = (id: string) => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({
      type: "note:delete",
      payload: { id }
    }));
  };

  const topNotes = useMemo(() => {
    return [...notes].sort((a, b) => b.votes - a.votes).slice(0, 5);
  }, [notes]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  if (!roomId) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 italic serif">Brainstorm</h1>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Room Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. ALPHA-123"
                  className="flex-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name) {
                      setRoomId((e.target as HTMLInputElement).value.toUpperCase());
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="e.g. ALPHA-123"]') as HTMLInputElement;
                    if (name && input.value) {
                      setRoomId(input.value.toUpperCase());
                    }
                  }}
                  disabled={!name}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
                >
                  Join
                </button>
              </div>
            </div>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400 font-bold tracking-widest">Or</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (name) {
                  setRoomId(nanoid(6).toUpperCase());
                }
              }}
              disabled={!name}
              className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-black disabled:opacity-50 transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create New Board
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#f0f2f5] overflow-hidden relative font-sans">
      {/* Header */}
      <div className="absolute top-6 left-6 right-6 z-10 flex justify-between items-center pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="bg-white px-6 py-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="font-mono text-sm font-bold tracking-tighter">{roomId}</span>
            </div>
            <div className="h-4 w-[1px] bg-gray-200" />
            <div className="flex -space-x-2">
              {users.slice(0, 3).map((u) => (
                <div 
                  key={u.id}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: u.color }}
                  title={u.name}
                >
                  {u.name[0].toUpperCase()}
                </div>
              ))}
              {users.length > 3 && (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                  +{users.length - 3}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleAddNote}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2 font-bold pointer-events-auto"
          >
            <Plus className="w-5 h-5" />
            Add Note
          </button>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={cn(
              "p-3 rounded-2xl shadow-xl transition-all border border-gray-100",
              showSidebar ? "bg-gray-900 text-white" : "bg-white text-gray-900"
            )}
          >
            <TrendingUp className="w-5 h-5" />
          </button>
          <button
            onClick={() => setRoomId(null)}
            className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        draggable
        onWheel={handleWheel}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onDragEnd={(e) => {
          setStagePos({ x: e.target.x(), y: e.target.y() });
        }}
        className="cursor-grab active:cursor-grabbing"
      >
        <Layer>
          {/* Grid background */}
          {Array.from({ length: 40 }).map((_, i) => (
            <React.Fragment key={i}>
              <Rect
                x={-5000}
                y={i * 200 - 2500}
                width={10000}
                height={1}
                fill="#e5e7eb"
                opacity={0.5}
              />
              <Rect
                x={i * 200 - 2500}
                y={-5000}
                width={1}
                height={10000}
                fill="#e5e7eb"
                opacity={0.5}
              />
            </React.Fragment>
          ))}

          {notes.map((note) => (
            <Group
              key={note.id}
              x={note.x}
              y={note.y}
              draggable
              onDragEnd={(e) => {
                handleUpdateNote(note.id, { x: e.target.x(), y: e.target.y() });
              }}
            >
              {/* Sticky Note Shadow */}
              <Rect
                width={200}
                height={200}
                fill="#000"
                opacity={0.05}
                offsetX={-4}
                offsetY={-4}
                cornerRadius={4}
              />
              {/* Sticky Note Body */}
              <Rect
                width={200}
                height={200}
                fill={note.color}
                cornerRadius={4}
                stroke="#000"
                strokeWidth={0.5}
                opacity={0.95}
              />
              {/* Note Content */}
              <Text
                text={note.text}
                fontSize={16}
                fontFamily="Inter, sans-serif"
                padding={20}
                width={200}
                height={160}
                verticalAlign="top"
                onClick={() => {
                    const newText = prompt("Edit note:", note.text);
                    if (newText !== null) handleUpdateNote(note.id, { text: newText });
                }}
              />
              {/* Footer Info */}
              <Group y={165} x={15}>
                <Text
                  text={note.author}
                  fontSize={10}
                  fontStyle="bold"
                  fill="#4b5563"
                  fontFamily="Inter, sans-serif"
                />
                <Text
                  text={new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  fontSize={9}
                  fill="#9ca3af"
                  fontFamily="Inter, sans-serif"
                  y={12}
                />
              </Group>
              
              {/* Upvote Button Area */}
              <Group x={140} y={160}>
                <Rect
                    width={45}
                    height={25}
                    fill="rgba(255,255,255,0.5)"
                    cornerRadius={12}
                    onClick={() => handleUpvote(note.id)}
                />
                <Text
                    text={`▲ ${note.votes}`}
                    fontSize={12}
                    fontStyle="bold"
                    fill="#1f2937"
                    x={8}
                    y={6}
                    onClick={() => handleUpvote(note.id)}
                />
              </Group>

              {/* Delete Button */}
              <Group x={175} y={5}>
                <Text
                    text="×"
                    fontSize={20}
                    fill="#9ca3af"
                    onClick={() => handleDeleteNote(note.id)}
                    onMouseEnter={(e: any) => e.target.fill('#ef4444')}
                    onMouseLeave={(e: any) => e.target.fill('#9ca3af')}
                />
              </Group>
            </Group>
          ))}
        </Layer>
      </Stage>

      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="absolute top-24 right-6 bottom-6 w-80 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 flex flex-col gap-6 z-20"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Top Ideas
              </h2>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-1 rounded-full uppercase tracking-wider">Live</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {topNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                  <MessageSquare className="w-8 h-8 opacity-20" />
                  <p className="text-xs font-medium italic">No ideas yet...</p>
                </div>
              ) : (
                topNotes.map((note, idx) => (
                  <motion.div
                    layout
                    key={note.id}
                    className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm group hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-gray-400">#{idx + 1}</span>
                      <div className="flex items-center gap-1 text-blue-600 font-bold text-xs">
                        <ArrowBigUp className="w-4 h-4" />
                        {note.votes}
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 line-clamp-3 mb-3 font-medium leading-relaxed">
                      {note.text}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-500">
                          {note.author[0].toUpperCase()}
                        </div>
                        <span className="text-[10px] font-bold text-gray-500">{note.author}</span>
                      </div>
                      <button 
                        onClick={() => {
                            // Focus stage on note
                            setStagePos({
                                x: -note.x * stageScale + window.innerWidth / 2,
                                y: -note.y * stageScale + window.innerHeight / 2
                            });
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        View
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Active Users</span>
                <span>{users.length}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {users.map(u => (
                  <div 
                    key={u.id} 
                    className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: u.color }} />
                    <span className="text-[10px] font-bold text-gray-600">{u.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </div>
  );
}
