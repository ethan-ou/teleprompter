export interface CollaborationMessage {
    type: 'text-update' | 'position-sync' | 'user-joined' | 'user-left';
    data: any;
    userId: string;
    timestamp: number;
}
export interface RoomState {
    text: string;
    position: number;
    users: string[];
}
export interface CreateRoomRequest {
    text: string;
    position: number;
}
export interface JoinRoomRequest {
    roomId: string;
}
export interface UserInfo {
    id: string;
    isCreator: boolean;
}
export type CollaborationStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
