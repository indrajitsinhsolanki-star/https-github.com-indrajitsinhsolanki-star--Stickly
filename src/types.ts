export interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  author: string;
  timestamp: number;
  votes: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
}

export type Message =
  | { type: "join"; payload: { roomId: string; name: string; color: string } }
  | { type: "init"; payload: { notes: Note[]; users: User[]; userId: string } }
  | { type: "note:create"; payload: Omit<Note, "id" | "timestamp" | "votes"> }
  | { type: "note:created"; payload: Note }
  | { type: "note:update"; payload: Partial<Note> & { id: string } }
  | { type: "note:updated"; payload: Note }
  | { type: "note:upvote"; payload: { id: string } }
  | { type: "note:delete"; payload: { id: string } }
  | { type: "note:deleted"; payload: { id: string } }
  | { type: "user:joined"; payload: User }
  | { type: "user:left"; payload: { id: string } };
